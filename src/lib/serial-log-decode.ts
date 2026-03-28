/**
 * Decode KV4P binary frames into human-readable strings for the serial log page
 * (so it shows the same kind of messages as the browser console).
 */

import {
  DELIMITER,
  parseVersion,
  parseRssi,
  parseWindowUpdate,
  rawRssiToSUnits,
  CMD_HOST_PTT_DOWN,
  CMD_HOST_PTT_UP,
  CMD_HOST_GROUP,
  CMD_HOST_FILTERS,
  CMD_HOST_STOP,
  CMD_HOST_CONFIG,
  CMD_HOST_TX_AUDIO,
  CMD_HOST_HL,
  CMD_HOST_RSSI,
  CMD_SMETER_REPORT,
  CMD_PHYS_PTT_DOWN,
  CMD_PHYS_PTT_UP,
  CMD_DEBUG_INFO,
  CMD_DEBUG_ERROR,
  CMD_DEBUG_WARN,
  CMD_DEBUG_DEBUG,
  CMD_DEBUG_TRACE,
  CMD_HELLO,
  CMD_RX_AUDIO,
  CMD_VERSION,
  CMD_WINDOW_UPDATE,
} from "@/lib/kv4p-protocol";

const DELIMITER_LENGTH = 4;
const PROTO_MTU = 2048;

function hasDelimiterAt(data: Uint8Array, offset: number): boolean {
  if (offset + DELIMITER_LENGTH > data.length) return false;
  for (let i = 0; i < DELIMITER_LENGTH; i++) {
    if (data[offset + i] !== DELIMITER[i]) return false;
  }
  return true;
}

/** Returns frame length (delimiter + cmd + len + params) or 0 if not a complete frame. */
function getFrameLength(data: Uint8Array, offset: number): number {
  if (offset + DELIMITER_LENGTH + 1 + 2 > data.length) return 0;
  const plen = data[offset + 5]! | (data[offset + 6]! << 8);
  if (plen > PROTO_MTU) return 0;
  const total = DELIMITER_LENGTH + 1 + 2 + plen;
  if (offset + total > data.length) return 0;
  return total;
}

type TxDecoded = { text: string; type: SerialLogMessageType };

/** Decode a single host→device (TX) frame. Returns human-readable string and type or null. */
function decodeTxFrame(data: Uint8Array, offset: number, frameLen: number): TxDecoded | null {
  const cmd = data[offset + DELIMITER_LENGTH]!;
  const plen = data[offset + DELIMITER_LENGTH + 1]! | (data[offset + DELIMITER_LENGTH + 2]! << 8);
  const params = plen > 0 ? data.subarray(offset + DELIMITER_LENGTH + 3, offset + frameLen) : null;

  switch (cmd) {
    case CMD_HOST_STOP:
      return { text: "STOP", type: "stop" };
    case CMD_HOST_PTT_DOWN:
      return { text: "PTT_DOWN", type: "ptt_down" };
    case CMD_HOST_PTT_UP:
      return { text: "PTT_UP", type: "ptt_up" };
    case CMD_HOST_CONFIG:
      if (params && params.length >= 1) {
        const isHigh = params[0] !== 0;
        return { text: `CONFIG isHigh=${isHigh}`, type: "config" };
      }
      return { text: "CONFIG", type: "config" };
    case CMD_HOST_RSSI:
      if (params && params.length >= 1) {
        return { text: `RSSI on=${params[0] !== 0}`, type: "rssi" };
      }
      return { text: "RSSI", type: "rssi" };
    case CMD_HOST_GROUP:
      if (params && params.length >= 12) {
        const view = new DataView(params.buffer, params.byteOffset, params.byteLength);
        const freqTx = view.getFloat32(1, true);
        const freqRx = view.getFloat32(5, true);
        const squelch = params[9] ?? 0;
        return { text: `GROUP freqTx=${freqTx} freqRx=${freqRx} squelch=${squelch}`, type: "group" };
      }
      return { text: "GROUP", type: "group" };
    case CMD_HOST_FILTERS:
      if (params && params.length >= 1) {
        const f = params[0]!;
        return { text: `FILTERS pre=${!!(f & 1)} high=${!!(f & 2)} low=${!!(f & 4)}`, type: "filters" };
      }
      return { text: "FILTERS", type: "filters" };
    case CMD_HOST_TX_AUDIO:
      return { text: `TX_AUDIO (${plen} bytes)`, type: "tx_audio" };
    case CMD_HOST_HL:
      if (params && params.length >= 1) {
        return { text: `HL isHigh=${params[0] !== 0}`, type: "hl" };
      }
      return { text: "HL", type: "hl" };
    default:
      return { text: `CMD 0x${cmd.toString(16)} (${plen} bytes)`, type: "other" };
  }
}

type RxDecoded = { text: string; type: SerialLogMessageType };

/** Decode a single device→host (RX) frame. Returns human-readable string and type or null. */
function decodeRxFrame(data: Uint8Array, offset: number, frameLen: number): RxDecoded | null {
  const cmd = data[offset + DELIMITER_LENGTH]!;
  const plen = data[offset + DELIMITER_LENGTH + 1]! | (data[offset + DELIMITER_LENGTH + 2]! << 8);
  const params = plen > 0 ? data.subarray(offset + DELIMITER_LENGTH + 3, offset + frameLen) : null;

  switch (cmd) {
    case CMD_HELLO:
      return { text: "HELLO", type: "hello" };
    case CMD_VERSION:
      if (params && params.length >= 12) {
        const v = parseVersion(params);
        return { text: `VERSION ver=${v.ver} radio=${v.radioModuleStatus} window=${v.windowSize} rfType=${v.rfModuleType} features=${v.features}`, type: "version" };
      }
      return { text: "VERSION", type: "version" };
    case CMD_SMETER_REPORT:
      if (params && params.length >= 1) {
        const raw = parseRssi(params);
        const s = rawRssiToSUnits(raw);
        return { text: `SMETER rssi=${raw} (S${s})`, type: "smeter" };
      }
      return { text: "SMETER", type: "smeter" };
    case CMD_RX_AUDIO:
      return { text: `RX_AUDIO (${plen} bytes)`, type: "rx_audio" };
    case CMD_WINDOW_UPDATE:
      if (params && params.length >= 4) {
        const n = parseWindowUpdate(params);
        return { text: `WINDOW_UPDATE ${n}`, type: "window_update" };
      }
      return { text: "WINDOW_UPDATE", type: "window_update" };
    case CMD_PHYS_PTT_DOWN:
      return { text: "PHYS_PTT_DOWN", type: "phys_ptt_down" };
    case CMD_PHYS_PTT_UP:
      return { text: "PHYS_PTT_UP", type: "phys_ptt_up" };
    case CMD_DEBUG_INFO:
      return { text: params && params.length > 0 ? `[INFO] ${decodeDebugBytes(params)}` : "[INFO]", type: "debug" };
    case CMD_DEBUG_ERROR:
      return { text: params && params.length > 0 ? `[ERROR] ${decodeDebugBytes(params)}` : "[ERROR]", type: "debug" };
    case CMD_DEBUG_WARN:
      return { text: params && params.length > 0 ? `[WARN] ${decodeDebugBytes(params)}` : "[WARN]", type: "debug" };
    case CMD_DEBUG_DEBUG:
      return { text: params && params.length > 0 ? `[DEBUG] ${decodeDebugBytes(params)}` : "[DEBUG]", type: "debug" };
    case CMD_DEBUG_TRACE:
      return { text: params && params.length > 0 ? `[TRACE] ${decodeDebugBytes(params)}` : "[TRACE]", type: "debug" };
    default:
      return { text: `CMD 0x${cmd.toString(16)} (${plen} bytes)`, type: "other" };
  }
}

function decodeDebugBytes(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(data).replace(/\0/g, "").trim();
  } catch {
    return `(${data.length} bytes)`;
  }
}

/** Message type for filtering and color-coding the serial log. */
export type SerialLogMessageType =
  | "rx_audio"
  | "smeter"
  | "hello"
  | "version"
  | "window_update"
  | "config"
  | "rssi"
  | "stop"
  | "group"
  | "filters"
  | "ptt_down"
  | "ptt_up"
  | "tx_audio"
  | "hl"
  | "phys_ptt_down"
  | "phys_ptt_up"
  | "debug"
  | "raw"
  | "other";

export interface DecodedEntry {
  /** Decoded human-readable message (like console). */
  text: string;
  /** Byte length consumed from the chunk. */
  consumed: number;
  /** Message type for filtering/color. */
  type: SerialLogMessageType;
}

/**
 * Extract the first complete KV4P frame from the start of data (host→device / TX).
 * Returns decoded message, type, and length consumed, or null if no complete frame.
 */
export function decodeNextTxFrame(data: Uint8Array, offset = 0): DecodedEntry | null {
  if (!hasDelimiterAt(data, offset)) return null;
  const frameLen = getFrameLength(data, offset);
  if (frameLen === 0) return null;
  const decoded = decodeTxFrame(data, offset, frameLen);
  return decoded ? { text: decoded.text, consumed: frameLen, type: decoded.type } : null;
}

/**
 * Extract the first complete KV4P frame from the start of data (device→host / RX).
 */
export function decodeNextRxFrame(data: Uint8Array, offset = 0): DecodedEntry | null {
  if (!hasDelimiterAt(data, offset)) return null;
  const frameLen = getFrameLength(data, offset);
  if (frameLen === 0) return null;
  const decoded = decodeRxFrame(data, offset, frameLen);
  return decoded ? { text: decoded.text, consumed: frameLen, type: decoded.type } : null;
}

export interface DecodedChunkEntry {
  text: string;
  data: Uint8Array;
  type: SerialLogMessageType;
}

/**
 * Process a chunk and return a list of entries: decoded messages for each complete
 * KV4P frame, plus one raw entry for any remaining bytes.
 */
export function decodeTxChunk(data: Uint8Array): DecodedChunkEntry[] {
  const result: DecodedChunkEntry[] = [];
  let offset = 0;
  while (offset < data.length) {
    const decoded = decodeNextTxFrame(data, offset);
    if (decoded) {
      result.push({
        text: decoded.text,
        data: data.subarray(offset, offset + decoded.consumed),
        type: decoded.type,
      });
      offset += decoded.consumed;
    } else {
      break;
    }
  }
  if (offset < data.length) {
    result.push({ text: "", data: data.subarray(offset), type: "raw" });
  }
  return result;
}

export function decodeRxChunk(data: Uint8Array): DecodedChunkEntry[] {
  const result: DecodedChunkEntry[] = [];
  let offset = 0;
  while (offset < data.length) {
    const decoded = decodeNextRxFrame(data, offset);
    if (decoded) {
      result.push({
        text: decoded.text,
        data: data.subarray(offset, offset + decoded.consumed),
        type: decoded.type,
      });
      offset += decoded.consumed;
    } else {
      break;
    }
  }
  if (offset < data.length) {
    result.push({ text: "", data: data.subarray(offset), type: "raw" });
  }
  return result;
}
