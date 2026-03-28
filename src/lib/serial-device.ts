/**
 * Web Serial connection for KV4P-HT (USB cable).
 * Same KV4P protocol as BLE; use when the board is plugged in via USB.
 */

const KV4P_BAUD = 115200;

declare global {
  interface Navigator {
    serial?: {
      getPorts(): Promise<SerialPort[]>;
      requestPort(options?: { filters?: SerialPortFilter[] }): Promise<SerialPort>;
    };
  }
}

let port: SerialPort | null = null;
let readAbort: AbortController | null = null;

let onConnectCb: (() => void) | null = null;
let onDisconnectCb: (() => void) | null = null;
let onErrorCb: ((message: string) => void) | null = null;
let onDataCb: ((data: Uint8Array) => void) | null = null;
/** Optional: raw RX chunk for serial log (same data as onData, for UI). */
let onSerialRxChunkCb: ((data: Uint8Array) => void) | null = null;
/** Optional: raw TX chunk for serial log. */
let onSerialTxChunkCb: ((data: Uint8Array) => void) | null = null;

let serialRxLastLog = 0;
let serialRxTotal = 0;
let serialRxFirstChunkLogged = false;

/** Serialize writes so only one getWriter() is active at a time (avoids "WritableStream is locked"). */
let writeTail: Promise<void> = Promise.resolve();

function clearConnection() {
  port = null;
  readAbort = null;
  serialRxTotal = 0;
  serialRxLastLog = 0;
  serialRxFirstChunkLogged = false;
  writeTail = Promise.resolve();
}

function notifyDisconnected() {
  console.log("[Serial] Disconnected");
  clearConnection();
  onDisconnectCb?.();
}

export function isSerialSupported(): boolean {
  if (typeof navigator === "undefined" || !navigator.serial) return false;
  if (typeof window !== "undefined" && !window.isSecureContext) return false;
  return true;
}

export function isSerialConnected(): boolean {
  return port != null;
}

export function setSerialCallbacks(callbacks: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  onData?: (data: Uint8Array) => void;
  /** Raw RX chunk for serial log UI (same stream as onData). */
  onSerialRxChunk?: (data: Uint8Array) => void;
  /** Raw TX chunk for serial log UI. */
  onSerialTxChunk?: (data: Uint8Array) => void;
}) {
  onConnectCb = callbacks.onConnect ?? null;
  onDisconnectCb = callbacks.onDisconnect ?? null;
  onErrorCb = callbacks.onError ?? null;
  onDataCb = callbacks.onData ?? null;
  onSerialRxChunkCb = callbacks.onSerialRxChunk ?? null;
  onSerialTxChunkCb = callbacks.onSerialTxChunk ?? null;
}

async function runReadLoop(p: SerialPort): Promise<void> {
  if (!p.readable) return;
  const reader = p.readable.getReader();
  const ab = new AbortController();
  readAbort = ab;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done || readAbort !== ab) break;
      if (value && value.length > 0) {
        if (!serialRxFirstChunkLogged) {
          console.log("[Serial] first chunk received,", value.length, "bytes");
          serialRxFirstChunkLogged = true;
        }
        serialRxTotal += value.length;
        const now = Date.now();
        if (now - serialRxLastLog >= 2000) {
          console.log("[Serial] received", serialRxTotal, "bytes (last 2s)");
          serialRxLastLog = now;
          serialRxTotal = 0;
        }
        const copy = new Uint8Array(value);
        onSerialRxChunkCb?.(copy);
        onDataCb?.(copy);
      }
    }
  } catch (e) {
    if (readAbort !== ab) return;
    const msg = e instanceof Error ? e.message : String(e);
    onErrorCb?.(msg);
  } finally {
    readAbort = null;
    reader.releaseLock();
    notifyDisconnected();
  }
}

function serialOpenErrorMessage(raw: string): string {
  if (/failed to open serial port|Failed to open/i.test(raw)) {
    return "Port in use. Close the Arduino Serial Monitor (or any other app using the port), then try again.";
  }
  return raw;
}

/** Toggle DTR to reset the board so it boots clean before we send commands. */
async function triggerBoardReset(p: SerialPort): Promise<void> {
  if (typeof p.setSignals !== "function") return;
  try {
    await p.setSignals({ dataTerminalReady: false });
    await new Promise((r) => setTimeout(r, 80));
    await p.setSignals({ dataTerminalReady: true });
    console.log("[Serial] Board reset (DTR) done");
  } catch (e) {
    console.warn("[Serial] Board reset failed (non-fatal):", e);
  }
}

async function openPort(p: SerialPort): Promise<boolean> {
  try {
    await p.open({ baudRate: KV4P_BAUD });
    port = p;
    await triggerBoardReset(p);
    p.addEventListener("disconnect", () => notifyDisconnected());
    onConnectCb?.();
    runReadLoop(p);
    return true;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    onErrorCb?.(serialOpenErrorMessage(raw));
    return false;
  }
}

/**
 * Try to reconnect to a previously granted port (no user gesture).
 * Call on app load to get "USB Connected" immediately when the board is plugged in.
 */
export async function tryReconnectSerial(): Promise<boolean> {
  if (!isSerialSupported()) return false;
  const ports = await navigator.serial!.getPorts();
  if (ports.length === 0) return false;
  return openPort(ports[0]);
}

/**
 * Request a serial port (requires user gesture) and connect.
 * Does a full disconnect first so we always start from a clean state.
 */
export async function connectSerial(): Promise<void> {
  if (!isSerialSupported()) {
    onErrorCb?.("Web Serial is not supported. Use HTTPS and a supported browser.");
    return;
  }
  await disconnectSerial();
  const chosen = await navigator.serial!.requestPort();
  await openPort(chosen);
}

export async function disconnectSerial(): Promise<void> {
  if (readAbort) readAbort.abort();
  if (port) {
    try {
      await port.close();
    } catch {
      /* ignore */
    }
    clearConnection();
    onDisconnectCb?.();
  }
}

export async function writeSerial(data: Uint8Array): Promise<void> {
  if (!port || !port.writable) throw new Error("Not connected");
  const p = port;
  const runWrite = async (): Promise<void> => {
    onSerialTxChunkCb?.(data);
    const writer = p.writable!.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  };
  writeTail = writeTail.then(runWrite, runWrite);
  await writeTail;
}
