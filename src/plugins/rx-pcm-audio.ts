/**
 * iOS: play decoded RX PCM via AVAudioEngine (survives screen lock; WKWebView Web Audio does not).
 */
import { registerPlugin } from "@capacitor/core";

export interface RxPcmAudioPlugin {
  prepare(options: { sampleRate: number }): Promise<void>;
  /** Mono s16le PCM, base64-encoded (matches AVAudioFormat pcmFormatInt16 interleaved). */
  enqueueInt16(options: { b64: string }): Promise<void>;
  stop(): Promise<void>;
}

export const RxPcmAudio = registerPlugin<RxPcmAudioPlugin>("RxPcmAudio", {
  web: {
    prepare: async () => {},
    enqueueInt16: async () => {},
    stop: async () => {},
  },
});
