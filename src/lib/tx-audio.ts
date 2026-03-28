/**
 * TX audio: capture microphone, encode to Opus (48 kHz, mono, 40 ms frames),
 * and pass each encoded frame to the provided callback. Matches firmware expectations.
 * Uses WebCodecs AudioEncoder when available; requires user gesture to start.
 */

const SAMPLE_RATE = 48000;
const FRAME_DURATION_MS = 40;
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 1920

export interface TxAudioHandle {
  stop(): void;
  readonly active: boolean;
}

function isAudioEncoderSupported(): boolean {
  return typeof AudioEncoder !== "undefined";
}

/**
 * Start TX audio: request mic, create encoder, stream 40 ms Opus frames to sendFrame.
 * Resolves with a handle to stop, or rejects if unsupported or permission denied.
 */
export async function startTxAudio(
  sendFrame: (data: Uint8Array) => void
): Promise<TxAudioHandle> {
  if (!isAudioEncoderSupported()) {
    throw new Error("Opus encoding not supported in this browser. Try Chrome or Edge.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: SAMPLE_RATE,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  }).catch(async () => {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  });

  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const source = ctx.createMediaStreamSource(stream);
  let active = true;

  const encoder = new AudioEncoder({
    output: (chunk: EncodedAudioChunk) => {
      if (!active || chunk.byteLength === 0) return;
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      sendFrame(data);
    },
    error: (e: Error) => {
      console.warn("[TX audio] Encoder error:", e);
    },
  });

  const encoderConfig: AudioEncoderConfig = {
    codec: "opus",
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitrate: 24_000,
    opus: {
      format: "opus",
      frameDuration: 40_000,
      signal: "voice",
      application: "voip",
    },
  };
  encoder.configure(encoderConfig);

  const buffer: number[] = [];
  const scriptNode = ctx.createScriptProcessor(1024, 1, 1);
  scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
    if (!active) return;
    const input = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) buffer.push(input[i]);

    while (buffer.length >= SAMPLES_PER_FRAME) {
      const frame = new Float32Array(SAMPLES_PER_FRAME);
      for (let i = 0; i < SAMPLES_PER_FRAME; i++) frame[i] = buffer.shift()!;
      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate: SAMPLE_RATE,
        numberOfFrames: SAMPLES_PER_FRAME,
        numberOfChannels: 1,
        data: frame.buffer,
      });
      encoder.encode(audioData);
      audioData.close();
    }
  };
  source.connect(scriptNode);
  scriptNode.connect(ctx.destination);

  function stop(): void {
    if (!active) return;
    active = false;
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* tracks may already be stopped */
    }
    try {
      scriptNode.disconnect();
      source.disconnect();
    } catch {
      /* nodes may already be disconnected */
    }
    encoder.close();
    ctx.close();
  }

  return {
    stop,
    get active() {
      return active;
    },
  };
}
