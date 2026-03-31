/**
 * RX audio playback: decode Opus chunks from the device.
 * - iOS native: AVAudioEngine PCM (continues when screen locks; WKWebView Web Audio does not).
 * - Else: Web Audio API scheduling.
 * Matches firmware: 48 kHz, mono, Opus (narrowband, 40 ms frames).
 */

import { OpusDecoder } from "opus-decoder";

const SAMPLE_RATE = 48000;
/** First samples start after this delay so bursts + Wi‑Fi jitter do not underrun the graph. */
const INITIAL_PLAYOUT_DELAY_S = 0.22;
/** Rebuild this much lead when the schedule drifts behind (reduces chop from uneven chunk arrival). */
const MIN_PLAYOUT_LEAD_S = 0.09;
const VOLUME_MIN = 0.1;
const VOLUME_MAX = 3;
const VOLUME_STEP = 0.2;
const VOLUME_DEFAULT = 1.5;

export interface RxPlaybackHandle {
  pushChunk(data: Uint8Array): void;
  destroy(): void;
  readonly destroyed: boolean;
  /** Call from a user gesture (e.g. first tap after refresh) to unlock audio when context is suspended. */
  resumeIfSuspended(): Promise<void>;
  /** Output volume 0.25–3. Get/set for persistence or UI. */
  getVolume(): number;
  setVolume(gain: number): void;
  volumeUp(): void;
  volumeDown(): void;
}

function int16PcmToBase64(int16: Int16Array): string {
  const u8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(bin);
}

/**
 * iOS Capacitor: decode in JS, play PCM natively (background-safe).
 */
async function createIosNativeRxPlayback(initialVolume?: number): Promise<RxPlaybackHandle> {
  const { RxPcmAudio } = await import("@/plugins/rx-pcm-audio");
  const decoder = new OpusDecoder();
  await decoder.ready;
  await RxPcmAudio.prepare({ sampleRate: SAMPLE_RATE });

  const clampedDefault =
    initialVolume != null && Number.isFinite(initialVolume)
      ? Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, initialVolume))
      : VOLUME_DEFAULT;
  let currentGain = clampedDefault;
  let destroyed = false;
  let firstPlayLogged = false;

  function clampGain(g: number): number {
    return Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, g));
  }

  /** Serialize native enqueue so frame order is preserved. */
  let enqueueChain: Promise<void> = Promise.resolve();

  async function decodeAndEnqueue(data: Uint8Array): Promise<void> {
    if (destroyed || data.length === 0) return;
    const result = decoder.decodeFrame(data);
    if (!result?.channelData?.[0] || result.samplesDecoded === 0) return;
    const ch = result.channelData[0];
    const n = result.samplesDecoded;
    const int16 = new Int16Array(n);
    const g = currentGain;
    for (let i = 0; i < n; i++) {
      let s = ch[i] * g;
      s = Math.max(-1, Math.min(1, s));
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
    }
    const b64 = int16PcmToBase64(int16);
    await RxPcmAudio.enqueueInt16({ b64 });
    if (!firstPlayLogged) {
      firstPlayLogged = true;
      console.log("[RX audio] first frame (iOS native PCM engine)");
    }
  }

  function pushChunk(data: Uint8Array): void {
    enqueueChain = enqueueChain
      .then(() => decodeAndEnqueue(data))
      .catch(() => {
        /* bad frame or bridge error */
      });
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    void enqueueChain
      .catch(() => {})
      .finally(() => {
        void RxPcmAudio.stop();
        try {
          decoder.free();
        } catch {
          /* decoder may already be freed */
        }
      });
  }

  return {
    pushChunk,
    destroy,
    resumeIfSuspended: async () => {
      /* Native engine does not use suspended Web Audio */
    },
    getVolume: () => (destroyed ? VOLUME_DEFAULT : currentGain),
    setVolume: (gain: number) => {
      if (destroyed) return;
      currentGain = clampGain(gain);
    },
    volumeUp: () => {
      currentGain = clampGain(currentGain + VOLUME_STEP);
    },
    volumeDown: () => {
      currentGain = clampGain(currentGain - VOLUME_STEP);
    },
    get destroyed() {
      return destroyed;
    },
  };
}

/**
 * Web / Android: Web Audio API.
 */
async function createWebRxPlayback(initialVolume?: number): Promise<RxPlaybackHandle> {
  const decoder = new OpusDecoder();
  await decoder.ready;

  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const gainNode = ctx.createGain();
  const clampedDefault =
    initialVolume != null && Number.isFinite(initialVolume)
      ? Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, initialVolume))
      : VOLUME_DEFAULT;
  let currentGain = clampedDefault;
  gainNode.gain.value = currentGain;
  gainNode.connect(ctx.destination);

  let nextStartTime = 0;
  let playoutPrimed = false;
  let destroyed = false;
  let firstPlayLogged = false;

  function clampGain(g: number): number {
    return Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, g));
  }

  function getVolume(): number {
    return destroyed ? VOLUME_DEFAULT : currentGain;
  }

  function setVolume(gain: number): void {
    if (destroyed) return;
    currentGain = clampGain(gain);
    gainNode.gain.setTargetAtTime(currentGain, ctx.currentTime, 0.05);
  }

  function volumeUp(): void {
    setVolume(currentGain + VOLUME_STEP);
  }

  function volumeDown(): void {
    setVolume(currentGain - VOLUME_STEP);
  }

  function pushChunk(data: Uint8Array): void {
    if (destroyed || data.length === 0) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    try {
      const result = decoder.decodeFrame(data);
      if (!result?.channelData?.[0] || result.samplesDecoded === 0) return;

      const { channelData, samplesDecoded, sampleRate } = result;
      const now = ctx.currentTime;
      if (!playoutPrimed) {
        nextStartTime = now + INITIAL_PLAYOUT_DELAY_S;
        playoutPrimed = true;
      }
      if (nextStartTime < now + MIN_PLAYOUT_LEAD_S) {
        nextStartTime = now + MIN_PLAYOUT_LEAD_S;
      }

      const duration = samplesDecoded / sampleRate;
      const buffer = ctx.createBuffer(1, samplesDecoded, sampleRate);
      buffer.copyToChannel(channelData[0], 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(nextStartTime);
      nextStartTime += duration;

      if (!firstPlayLogged) {
        firstPlayLogged = true;
        console.log("[RX audio] first frame played to speakers (Web Audio)");
      }
    } catch {
      // Skip corrupted or invalid frames
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    try {
      decoder.free();
    } catch {
      /* decoder may already be freed */
    }
    ctx.close();
  }

  async function resumeIfSuspended(): Promise<void> {
    if (destroyed) return;
    if (ctx.state === "suspended") await ctx.resume();
  }

  return {
    pushChunk,
    destroy,
    resumeIfSuspended,
    getVolume,
    setVolume,
    volumeUp,
    volumeDown,
    get destroyed() {
      return destroyed;
    },
  };
}

/**
 * Initialize RX playback. On iOS Capacitor, uses native PCM engine for lock-screen playback.
 */
export async function createRxPlayback(initialVolume?: number): Promise<RxPlaybackHandle> {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    return createIosNativeRxPlayback(initialVolume);
  }
  return createWebRxPlayback(initialVolume);
}
