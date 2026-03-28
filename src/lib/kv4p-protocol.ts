/**
 * KV4P-HT protocol: packet format and command codes.
 * Packet: [0xDE, 0xAD, 0xBE, 0xEF] [cmd 1 byte] [paramLen 2 bytes LE] [params...]
 */

export const DELIMITER = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const DELIMITER_LENGTH = 4;

// Host → device (we send)
export const CMD_HOST_PTT_DOWN = 0x01;
export const CMD_HOST_PTT_UP = 0x02;
export const CMD_HOST_GROUP = 0x03;
export const CMD_HOST_FILTERS = 0x04;
export const CMD_HOST_STOP = 0x05;
export const CMD_HOST_CONFIG = 0x06;
export const CMD_HOST_TX_AUDIO = 0x07;
export const CMD_HOST_HL = 0x08;
export const CMD_HOST_RSSI = 0x09;

// Device → host (we receive)
export const CMD_SMETER_REPORT = 0x53;
export const CMD_PHYS_PTT_DOWN = 0x44;
export const CMD_PHYS_PTT_UP = 0x55;
export const CMD_DEBUG_INFO = 0x01;
export const CMD_DEBUG_ERROR = 0x02;
export const CMD_DEBUG_WARN = 0x03;
export const CMD_DEBUG_DEBUG = 0x04;
export const CMD_DEBUG_TRACE = 0x05;
export const CMD_HELLO = 0x06;
export const CMD_RX_AUDIO = 0x07;
export const CMD_VERSION = 0x08;
export const CMD_WINDOW_UPDATE = 0x09;

const PROTO_MTU = 2048;

/** Build one KV4P packet. */
export function buildPacket(cmd: number, params?: Uint8Array): Uint8Array {
  const plen = params?.length ?? 0;
  const packet = new Uint8Array(DELIMITER_LENGTH + 1 + 2 + plen);
  packet.set(DELIMITER, 0);
  packet[4] = cmd;
  packet[5] = plen & 0xff;
  packet[6] = (plen >> 8) & 0xff;
  if (plen > 0 && params) packet.set(params, 7);
  return packet;
}

export interface VersionPayload {
  ver: number;
  radioModuleStatus: string;
  windowSize: number;
  rfModuleType: number;
  features: number;
}

/** Version packet is 12 bytes LE (match .original-poc reference and firmware working copy): ver(2), radioStatus(1), windowSize(4), rfModuleType(4), features(1). */
export function parseVersion(data: Uint8Array): VersionPayload {
  if (data.length < 12) {
    return { ver: 0, radioModuleStatus: "u", windowSize: 0, rfModuleType: 0, features: 0 };
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    ver: view.getUint16(0, true),
    radioModuleStatus: String.fromCharCode(data[2]),
    windowSize: view.getUint32(3, true),
    rfModuleType: view.getUint32(7, true),
    features: data[11],
  };
}

export function parseRssi(data: Uint8Array): number {
  return data[0];
}

/**
 * Map raw RSSI (0–255) from COMMAND_SMETER_REPORT to S-units (0–9) for display.
 * Formula from spec: 9.73*ln(0.0297*val)-1.88, clamped to 0–9.
 */
export function rawRssiToSUnits(raw: number): number {
  if (raw <= 0) return 0;
  const s = 9.73 * Math.log(0.0297 * raw) - 1.88;
  return Math.max(0, Math.min(9, Math.round(s)));
}

export function parseWindowUpdate(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
}

/** COMMAND_HOST_GROUP params: bw, freq_tx, freq_rx (float), ctcss_tx, squelch, ctcss_rx */
export function buildGroup(params: {
  bw: number;
  freqTx: number;
  freqRx: number;
  ctcssTx: number;
  squelch: number;
  ctcssRx: number;
}): Uint8Array {
  const buf = new ArrayBuffer(12);
  const view = new DataView(buf);
  view.setUint8(0, params.bw);
  view.setFloat32(1, params.freqTx, true);
  view.setFloat32(5, params.freqRx, true);
  view.setUint8(9, params.ctcssTx);
  view.setUint8(10, params.squelch);
  view.setUint8(11, params.ctcssRx);
  return new Uint8Array(buf);
}

/** COMMAND_HOST_CONFIG: isHigh (bool, 1 byte) */
export function buildConfig(isHigh: boolean): Uint8Array {
  return new Uint8Array([isHigh ? 1 : 0]);
}

/** COMMAND_HOST_RSSI: on (bool, 1 byte) */
export function buildRssiState(on: boolean): Uint8Array {
  return new Uint8Array([on ? 1 : 0]);
}

/** COMMAND_WINDOW_UPDATE: size (4 bytes LE) */
export function buildWindowUpdate(size: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, size, true);
  return new Uint8Array(buf);
}

export type Kv4pCommandHandler = (
  cmd: number,
  params: Uint8Array
) => void;

/**
 * Feed raw bytes from BLE; calls handler for each complete packet.
 * Handles split frames across multiple BLE notifications.
 */
export class Kv4pParser {
  private buf: number[] = [];
  private handler: Kv4pCommandHandler;

  constructor(handler: Kv4pCommandHandler) {
    this.handler = handler;
  }

  feed(chunk: Uint8Array): void {
    for (let i = 0; i < chunk.length; i++) this.buf.push(chunk[i]);
    this.drain();
  }

  private drain(): void {
    while (this.buf.length >= DELIMITER_LENGTH + 1 + 2) {
      let i = 0;
      for (; i <= this.buf.length - DELIMITER_LENGTH; i++) {
        if (
          this.buf[i] === 0xde &&
          this.buf[i + 1] === 0xad &&
          this.buf[i + 2] === 0xbe &&
          this.buf[i + 3] === 0xef
        ) break;
      }
      if (i > this.buf.length - DELIMITER_LENGTH) {
        this.buf = this.buf.slice(-(DELIMITER_LENGTH - 1));
        return;
      }
      if (i > 0) this.buf = this.buf.slice(i);
      const cmd = this.buf[4];
      const plen = this.buf[5] | (this.buf[6] << 8);
      if (plen > PROTO_MTU) {
        this.buf = this.buf.slice(1);
        continue;
      }
      const need = DELIMITER_LENGTH + 1 + 2 + plen;
      if (this.buf.length < need) return;
      const params = new Uint8Array(plen);
      for (let j = 0; j < plen; j++) params[j] = this.buf[7 + j];
      this.handler(cmd, params);
      this.buf = this.buf.slice(need);
    }
  }

  reset(): void {
    this.buf = [];
  }
}
