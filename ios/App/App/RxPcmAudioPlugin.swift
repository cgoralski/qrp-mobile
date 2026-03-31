import Foundation
import Capacitor
import AVFoundation

/// Plays mono 16-bit PCM through AVAudioEngine so RX audio continues when the screen is locked.
/// WKWebView suspends Web Audio in background; this path uses the same process audio session as RadioLinkKeepAlive.
@objc(RxPcmAudioPlugin)
public class RxPcmAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RxPcmAudioPlugin"
    public let jsName = "RxPcmAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enqueueInt16", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var engine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var pcmFormat: AVAudioFormat?
    private let stateLock = NSLock()

    private func tearDown() {
        stateLock.lock()
        defer { stateLock.unlock() }
        playerNode?.stop()
        playerNode = nil
        engine?.stop()
        engine = nil
        pcmFormat = nil
    }

    @objc public func prepare(_ call: CAPPluginCall) {
        let rate = call.getDouble("sampleRate") ?? 48_000
        DispatchQueue.main.async {
            self.tearDown()
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try AVAudioSession.sharedInstance().setActive(true)

                guard let fmt = AVAudioFormat(
                    commonFormat: .pcmFormatInt16,
                    sampleRate: rate,
                    channels: 1,
                    interleaved: true
                ) else {
                    call.reject("RxPcmAudio: bad audio format")
                    return
                }

                let eng = AVAudioEngine()
                let node = AVAudioPlayerNode()
                eng.attach(node)
                eng.connect(node, to: eng.mainMixerNode, format: fmt)

                try eng.start()
                node.play()

                self.stateLock.lock()
                self.engine = eng
                self.playerNode = node
                self.pcmFormat = fmt
                self.stateLock.unlock()

                call.resolve()
            } catch {
                self.tearDown()
                call.reject("RxPcmAudio prepare failed: \(error.localizedDescription)")
            }
        }
    }

    @objc public func enqueueInt16(_ call: CAPPluginCall) {
        guard let b64 = call.getString("b64"), let data = Data(base64Encoded: b64) else {
            call.resolve()
            return
        }
        if data.isEmpty || data.count % 2 != 0 {
            call.resolve()
            return
        }

        stateLock.lock()
        let fmt = self.pcmFormat
        let node = self.playerNode
        stateLock.unlock()

        guard let format = fmt, let player = node else {
            call.resolve()
            return
        }

        let frameCount = data.count / MemoryLayout<Int16>.size
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frameCount)) else {
            call.resolve()
            return
        }
        buffer.frameLength = AVAudioFrameCount(frameCount)

        data.withUnsafeBytes { raw in
            guard let base = raw.bindMemory(to: Int16.self).baseAddress,
                  let ch = buffer.int16ChannelData else { return }
            ch[0].assign(from: base, count: frameCount)
        }

        DispatchQueue.main.async {
            player.scheduleBuffer(buffer, completionHandler: nil)
            call.resolve()
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.tearDown()
            call.resolve()
        }
    }
}
