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
        CAPPluginMethod(name: "ensureReady", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var engine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var pcmFormat: AVAudioFormat?
    private let stateLock = NSLock()
    /// Avoid main-queue contention with WKWebView (was causing ~periodic RX glitches on enqueue).
    private let scheduleQueue = DispatchQueue(label: "com.qrpmobile.rxpcm", qos: .userInteractive)

    private func tearDown() {
        stateLock.lock()
        defer { stateLock.unlock() }
        playerNode?.stop()
        playerNode = nil
        engine?.stop()
        engine = nil
        pcmFormat = nil
    }

    /// Build graph and start playback. Caller must configure `AVAudioSession` first (prepare / ensureReady).
    private func installPlaybackEngine(sampleRate: Double) throws {
        guard let fmt = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: true
        ) else {
            throw NSError(domain: "RxPcmAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "bad audio format"])
        }

        let eng = AVAudioEngine()
        let node = AVAudioPlayerNode()
        eng.attach(node)
        eng.connect(node, to: eng.mainMixerNode, format: fmt)

        try eng.start()
        node.play()

        stateLock.lock()
        engine = eng
        playerNode = node
        pcmFormat = fmt
        stateLock.unlock()
    }

    @objc public func prepare(_ call: CAPPluginCall) {
        let rate = call.getDouble("sampleRate") ?? 48_000
        scheduleQueue.async {
            self.tearDown()
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try AVAudioSession.sharedInstance().setActive(true)
                try self.installPlaybackEngine(sampleRate: rate)
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

        scheduleQueue.async {
            self.stateLock.lock()
            let fmt = self.pcmFormat
            let player = self.playerNode
            self.stateLock.unlock()

            guard let format = fmt, let node = player else {
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

            node.scheduleBuffer(buffer, completionHandler: nil)
            call.resolve()
        }
    }

    /// After WKWebView TX (getUserMedia + AudioContext), the shared session is reconfigured. Soft
    /// `engine.start()` / `play()` is often not enough — the graph can look alive but output stays silent
    /// until a full rebuild (same as app reconnect calling `prepare`).
    @objc public func ensureReady(_ call: CAPPluginCall) {
        scheduleQueue.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
            } catch {
                call.reject("RxPcmAudio ensureReady session: \(error.localizedDescription)")
                return
            }

            self.stateLock.lock()
            let rate = self.pcmFormat?.sampleRate ?? 48_000
            self.stateLock.unlock()

            self.tearDown()
            do {
                try self.installPlaybackEngine(sampleRate: rate)
                call.resolve()
            } catch {
                call.reject("RxPcmAudio ensureReady rebuild: \(error.localizedDescription)")
            }
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        scheduleQueue.async {
            self.tearDown()
            call.resolve()
        }
    }
}
