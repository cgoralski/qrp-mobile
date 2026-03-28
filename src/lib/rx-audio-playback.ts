/**
 * RX audio playback: decode Opus chunks from the device and play via Web Audio API.
 * Matches firmware: 48 kHz, mono, Opus (narrowband, 40 ms frames).
 */

import { OpusDecoder } from "opus-decoder";

const SAMPLE_RATE = 48000;
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

/**
 * Initialize RX playback: Opus decoder + AudioContext, returns handle to push chunks and destroy.
 * Call from a user gesture (e.g. after connect) so AudioContext can start.
 * @param initialVolume Optional saved volume (0.1–3); clamped and used instead of VOLUME_DEFAULT.
 */
export async function createRxPlayback(initialVolume?: number): Promise<RxPlaybackHandle> {
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

  let nextStartTime = 0;
  let destroyed = false;
  let firstPlayLogged = false;

  function pushChunk(data: Uint8Array): void {
    if (destroyed || data.length === 0) return;
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    try {
      const result = decoder.decodeFrame(data);
      if (!result?.channelData?.[0] || result.samplesDecoded === 0) return;

      const { channelData, samplesDecoded, sampleRate } = result;
      const now = ctx.currentTime;
      if (nextStartTime < now) {
        nextStartTime = now;
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
        console.log("[RX audio] first frame played to speakers");
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
