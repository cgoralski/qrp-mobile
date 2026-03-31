import Foundation
import Capacitor
import AVFoundation

/// Keeps the app eligible for background execution (audio mode) and holds a quiet
/// looping buffer so WKWebView + native WebSocket are less likely to be suspended when the screen is off.
/// Routes RX/Web Audio to the **built-in speaker** when the screen locks (avoids earpiece-only output).
@objc(RadioLinkKeepAlivePlugin)
public class RadioLinkKeepAlivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RadioLinkKeepAlivePlugin"
    public let jsName = "RadioLinkKeepAlive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensureSpeakerOutput", returnType: CAPPluginReturnPromise)
    ]

    private var silentPlayer: AVAudioPlayer?
    private var routeObserver: NSObjectProtocol?
    private var keepAliveActive = false

    /// Prefer main speaker for radio-style playback; leave headphones / BT / CarPlay alone.
    private func applySpeakerRouteForRadioPlayback() {
        let session = AVAudioSession.sharedInstance()
        for output in session.currentRoute.outputs {
            switch output.portType {
            case .headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .airPlay:
                try? session.overrideOutputAudioPort(.none)
                return
            default:
                if #available(iOS 17.0, *), output.portType == .carAudio {
                    try? session.overrideOutputAudioPort(.none)
                    return
                }
            }
        }
        try? session.overrideOutputAudioPort(.speaker)
    }

    private func startRouteObserver() {
        stopRouteObserver()
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self = self, self.keepAliveActive else { return }
            self.applySpeakerRouteForRadioPlayback()
        }
    }

    private func stopRouteObserver() {
        if let o = routeObserver {
            NotificationCenter.default.removeObserver(o)
            routeObserver = nil
        }
    }

    @objc public func enable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)

                if self.silentPlayer == nil {
                    let wav = Self.makeSilentWav(numPcmSamples: 6615) // ~150 ms @ 44.1kHz mono
                    self.silentPlayer = try AVAudioPlayer(data: wav)
                    self.silentPlayer?.numberOfLoops = -1
                    self.silentPlayer?.volume = 0.001
                    self.silentPlayer?.prepareToPlay()
                }
                self.silentPlayer?.play()
                self.keepAliveActive = true
                self.applySpeakerRouteForRadioPlayback()
                self.startRouteObserver()
                call.resolve()
            } catch {
                call.reject("RadioLinkKeepAlive enable failed: \(error.localizedDescription)")
            }
        }
    }

    @objc public func ensureSpeakerOutput(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.keepAliveActive {
                self.applySpeakerRouteForRadioPlayback()
            }
            call.resolve()
        }
    }

    @objc public func disable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.keepAliveActive = false
            self.stopRouteObserver()
            self.silentPlayer?.stop()
            self.silentPlayer = nil
            try? AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve()
        }
    }

    private static func makeSilentWav(numPcmSamples: Int) -> Data {
        let sampleRate: UInt32 = 44100
        let bitsPerSample: UInt16 = 16
        let channels: UInt16 = 1
        let blockAlign = channels * bitsPerSample / 8
        let byteRate = sampleRate * UInt32(blockAlign)
        let dataSize = UInt32(numPcmSamples * Int(blockAlign))
        let riffPayload = 36 + dataSize

        var d = Data()
        d.append(contentsOf: "RIFF".utf8)
        d.appendUInt32LE(riffPayload)
        d.append(contentsOf: "WAVE".utf8)
        d.append(contentsOf: "fmt ".utf8)
        d.appendUInt32LE(16)
        d.appendUInt16LE(1)
        d.appendUInt16LE(channels)
        d.appendUInt32LE(sampleRate)
        d.appendUInt32LE(byteRate)
        d.appendUInt16LE(blockAlign)
        d.appendUInt16LE(bitsPerSample)
        d.append(contentsOf: "data".utf8)
        d.appendUInt32LE(dataSize)
        d.append(Data(repeating: 0, count: Int(dataSize)))
        return d
    }
}

private extension Data {
    mutating func appendUInt32LE(_ v: UInt32) {
        var le = v.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }
    mutating func appendUInt16LE(_ v: UInt16) {
        var le = v.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }
}
