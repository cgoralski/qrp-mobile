import { Capacitor } from "@capacitor/core";
import { logWifiDiag, previewBytesHex } from "@/lib/wifi-diagnostics";
import { logSession } from "@/lib/session-log";

/**
 * WebSocket client transport for KV4P-HT over WiFi.
 * - Capacitor iOS/Android: @miaz/capacitor-websocket (Starscream / native TCP; WKWebView JS WebSocket
 *   often fails to 192.168.x.x with 1006 on iOS).
 * - Browser/PWA: native WebSocket (watch HTTPS mixed-content for ws://).
 * Firmware sends KV4P frames as WebSocket TEXT (base64) and accepts BIN or TEXT; see wifi_ws.cpp.
 */

const DEFAULT_WS_PORT = 8765;
const PLUGIN_SOCKET_NAME = "board";

function iosNoInternetWifiHint(): string {
  try {
    if (Capacitor.getPlatform() !== "ios") return "";
  } catch {
    return "";
  }
  return " On iPhone/iPad: KV4P-Radio has no internet; if iOS asks, choose to keep using this Wi‑Fi for local access (not only cellular). That prompt can reset the link to the radio.";
}

/**
 * Map POSIX / Starscream errors to short UI copy. Detailed logs still use the raw string.
 */
export function formatWifiTransportError(raw: string): string {
  const s = raw.trim();
  const lower = s.toLowerCase();
  const hint = iosNoInternetWifiHint();
  if (
    lower.includes("connection reset by peer") ||
    lower.includes("rawvalue: 54") ||
    (lower.includes("posixerrorcode") && lower.includes("54"))
  ) {
    return `Wi‑Fi link to the radio dropped (connection reset). The app will try to reconnect shortly while you stay on KV4P-Radio.${hint}`;
  }
  if (lower.includes("broken pipe") || lower.includes("rawvalue: 32")) {
    return `Wi‑Fi link to the radio closed unexpectedly. Stay on KV4P-Radio; reconnecting if possible.${hint}`;
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return `Wi‑Fi connection timed out. Join KV4P-Radio and wait for the board to finish booting.${hint}`;
  }
  const base = s.length > 220 ? `${s.slice(0, 217)}…` : s;
  return hint && base.length < 400 ? `${base}${hint}` : base;
}

let ws: WebSocket | null = null;
let nativeConnected = false;
let pluginListeners: Array<{ remove: () => Promise<void> }> = [];

let onConnectCb: ((url: string) => void) | null = null;
let onDisconnectCb: (() => void) | null = null;
let onErrorCb: ((message: string) => void) | null = null;
let onDataCb: ((data: Uint8Array) => void) | null = null;
let wsRxDiagCount = 0;
let wsTxDiagCount = 0;
/** When native plugin reported connected (for delta logs on RST/errors). */
let nativeOpenAtMs: number | null = null;

/** True for Capacitor shell (iOS or Android) — use native plugin, not WKWebView WebSocket. */
async function isCapacitorNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function clearConnection(): Promise<void> {
  logWifiDiag("[WS] clearConnection() start");
  wsRxDiagCount = 0;
  wsTxDiagCount = 0;
  if (ws) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    ws = null;
  }

  nativeConnected = false;
  nativeOpenAtMs = null;
  for (const h of pluginListeners) {
    try {
      await h.remove();
    } catch {
      /* ignore */
    }
  }
  pluginListeners = [];

  // Native app: tear down Starscream socket. Patched plugin resolves disconnect() even when no socket
  // (stock plugin returned without resolve → JS await clearConnection hung forever).
  const nativeApp = await isCapacitorNativeApp();
  if (nativeApp) {
    try {
      const { CapacitorWebsocket } = await import("@miaz/capacitor-websocket");
      await CapacitorWebsocket.disconnect({ name: PLUGIN_SOCKET_NAME });
      logWifiDiag("[WS] clearConnection: native plugin disconnect done");
    } catch {
      /* ignore */
    }
  }

  logWifiDiag("[WS] clearConnection() done");
}

function notifyDisconnected() {
  console.log("[WebSocket] Disconnected");
  logWifiDiag("[WS] notifyDisconnected (socket closed)");
  onDisconnectCb?.();
}

export function isWifiSupported(): boolean {
  return typeof WebSocket !== "undefined";
}

export function isConnected(): boolean {
  return (ws != null && ws.readyState === WebSocket.OPEN) || nativeConnected;
}

export function setCallbacks(callbacks: {
  onConnect?: (url: string) => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
  onData?: (data: Uint8Array) => void;
}) {
  onConnectCb = callbacks.onConnect ?? null;
  onDisconnectCb = callbacks.onDisconnect ?? null;
  onErrorCb = callbacks.onError ?? null;
  onDataCb = callbacks.onData ?? null;
}

/**
 * Build WebSocket URL from host (or full URL) and optional port.
 * Uses ws:// (board has no TLS). If urlOrHost starts with ws:// or wss://, use as-is.
 */
function buildWsUrl(urlOrHost: string, port?: number): string {
  const trimmed = urlOrHost.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  const p = port ?? DEFAULT_WS_PORT;
  return `ws://${trimmed}:${p}`;
}

/**
 * When the SPA/PWA is served over HTTPS, browsers block `ws://` (insecure WebSocket) to a
 * device on the LAN — including ws://192.168.4.1. The native Capacitor build is not subject
 * to this rule. See documentation/pwa-wifi-and-https.md.
 */
export function getBrowserWsMixedContentBlockedMessage(): string | null {
  if (typeof window === "undefined") return null;
  if (window.location.protocol !== "https:") return null;
  return "Wi‑Fi to the board uses ws:// (no TLS). Safari and other browsers block that from an HTTPS page (including this PWA). Use the native QRP Mobile app for wireless control, or load the app over HTTP on your LAN.";
}

/** Decode base64 to Uint8Array (plugin sends binary as base64 string over the bridge). */
function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode Uint8Array to base64 for plugin send(). */
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

/**
 * Connect using the native Capacitor WebSocket plugin.
 */
async function connectNative(url: string): Promise<void> {
  const { CapacitorWebsocket } = await import("@miaz/capacitor-websocket");

  logWifiDiag("[WS] connectNative (Capacitor plugin iOS/Android) url=" + url);
  await clearConnection();

  return new Promise((resolve, reject) => {
    /** Prevents reject() after resolve() when Starscream errors arrive post-handshake. */
    let connectOutcomeSettled = false;

    const timeout = setTimeout(() => {
      if (connectOutcomeSettled) return;
      connectOutcomeSettled = true;
      logWifiDiag("[WS] native timeout 15s");
      onErrorCb?.("Connection timeout.");
      reject(new Error("Connection timeout"));
    }, 15000);

    const finishNativeError = (msg: string) => {
      clearTimeout(timeout);
      const openMs = nativeOpenAtMs;
      if (openMs != null) {
        logWifiDiag(`[WS] native plugin error (after open, ${Date.now() - openMs}ms): ${msg}`);
      } else {
        logWifiDiag("[WS] native plugin connect error: " + msg);
      }
      const hadOpen = nativeOpenAtMs != null;
      nativeConnected = false;
      nativeOpenAtMs = null;
      if (hadOpen) {
        notifyDisconnected();
      }
      onErrorCb?.(formatWifiTransportError(msg));
      if (!connectOutcomeSettled) {
        connectOutcomeSettled = true;
        reject(new Error(formatWifiTransportError(msg)));
      }
    };

    const onConnected = () => {
      clearTimeout(timeout);
      nativeConnected = true;
      nativeOpenAtMs = Date.now();
      console.log("[WebSocket] Connected to", url);
      logWifiDiag("[WS] native plugin: connected event");
      logSession("ws_native_tcp_open", { url: url.slice(0, 96) });
      onConnectCb?.(url);
      if (!connectOutcomeSettled) {
        connectOutcomeSettled = true;
        resolve();
      }
    };

    const onConnectError = (event: { exception?: string }) => {
      finishNativeError(event?.exception ?? "Connection failed.");
    };

    (async () => {
      try {
        logWifiDiag("[WS] native: build + applyListeners + connect");
        await CapacitorWebsocket.build({ name: PLUGIN_SOCKET_NAME, url });
        // iOS native: Starscream callbacks are only registered when applyListeners runs (see plugin Swift).
        await CapacitorWebsocket.applyListeners({ name: PLUGIN_SOCKET_NAME });

        const hMessage = await CapacitorWebsocket.addListener(
          `${PLUGIN_SOCKET_NAME}:message`,
          (event: { data?: unknown }) => {
            if (event?.data === undefined || event?.data === null) return;
            deliverWsMessageData(event.data);
          }
        );
        pluginListeners.push(hMessage);

        const hConnected = await CapacitorWebsocket.addListener(
          `${PLUGIN_SOCKET_NAME}:connected`,
          onConnected
        );
        pluginListeners.push(hConnected);

        const hDisconnected = await CapacitorWebsocket.addListener(
          `${PLUGIN_SOCKET_NAME}:disconnected`,
          () => {
            const openMs = nativeOpenAtMs;
            if (openMs != null) {
              logWifiDiag(`[WS] native plugin: disconnected event (was open ${Date.now() - openMs}ms)`);
            } else {
              logWifiDiag("[WS] native plugin: disconnected event");
            }
            nativeConnected = false;
            nativeOpenAtMs = null;
            notifyDisconnected();
          }
        );
        pluginListeners.push(hDisconnected);

        const hConnectError = await CapacitorWebsocket.addListener(
          `${PLUGIN_SOCKET_NAME}:connecterror`,
          onConnectError
        );
        pluginListeners.push(hConnectError);

        // Starscream reports failures via ":error" (Swift), not ":connecterror".
        const hStarscreamError = await CapacitorWebsocket.addListener(
          `${PLUGIN_SOCKET_NAME}:error`,
          (event: { cause?: string }) => {
            onConnectError({ exception: event?.cause ?? "WebSocket error" });
          }
        );
        pluginListeners.push(hStarscreamError);

        await CapacitorWebsocket.connect({ name: PLUGIN_SOCKET_NAME });
        logWifiDiag("[WS] native: connect() invoked");
      } catch (e) {
        clearTimeout(timeout);
        const msg = e instanceof Error ? e.message : String(e);
        logWifiDiag("[WS] native exception: " + msg);
        if (!connectOutcomeSettled) {
          connectOutcomeSettled = true;
          onErrorCb?.(msg);
          reject(e);
        }
      }
    })();
  });
}

/**
 * Connect to the board's WebSocket server.
 * @param urlOrHost - Full URL (ws://host:port) or hostname/IP (e.g. 192.168.4.1)
 * @param port - Optional port when urlOrHost is hostname/IP (default 8765)
 */
function deliverWsMessageData(data: unknown): void {
  if (!onDataCb) return;
  wsRxDiagCount += 1;
  const n = wsRxDiagCount;
  if (data instanceof ArrayBuffer) {
    if (n <= 15 || n % 40 === 0) {
      logWifiDiag(`[WS] rx #${n} ArrayBuffer len=${data.byteLength}`);
    }
    onDataCb(new Uint8Array(data));
    return;
  }
  if (typeof data === "string") {
    if (n <= 15 || n % 40 === 0) {
      logWifiDiag(`[WS] rx #${n} string len=${data.length} (base64 text from board)`);
    }
    try {
      onDataCb(base64ToUint8Array(data));
    } catch {
      if (n <= 5) logWifiDiag(`[WS] rx #${n} base64 decode failed`);
    }
    return;
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    if (n <= 15) logWifiDiag(`[WS] rx #${n} Blob size=${data.size}`);
    void data.arrayBuffer().then((buf) => {
      if (!onDataCb) return;
      if (n <= 15 || n % 40 === 0) {
        logWifiDiag(`[WS] rx #${n} Blob→ArrayBuffer len=${buf.byteLength}`);
      }
      onDataCb(new Uint8Array(buf));
    });
  }
}

/**
 * Standard WebSocket (browser / PWA only — not used in Capacitor native).
 */
async function connectStandardWebSocket(url: string): Promise<void> {
  const plat = await (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      return Capacitor.isNativePlatform() ? `native:${Capacitor.getPlatform()}` : "web";
    } catch {
      return "web?";
    }
  })();
  logWifiDiag(`[WS] connectStandardWebSocket url=${url} env=${plat} href=${typeof location !== "undefined" ? location.href : "n/a"}`);

  if (!isWifiSupported()) {
    logWifiDiag("[WS] WebSocket API missing");
    onErrorCb?.("WebSocket is not supported in this browser.");
    return Promise.reject(new Error("WebSocket is not supported"));
  }

  await clearConnection();

  const mixed = getBrowserWsMixedContentBlockedMessage();
  if (mixed && url.startsWith("ws://")) {
    logWifiDiag("[WS] blocked: HTTPS mixed content");
    onErrorCb?.(mixed);
    return Promise.reject(new Error(mixed));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    /** Must be true before we consider the socket connected (fixes iOS/WKWebView closing with wasClean before onopen). */
    let sawOpen = false;
    const timeout = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      logWifiDiag("[WS] standard: 15s timeout (no open/close in time)");
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
      const msg = "Connection timeout.";
      onErrorCb?.(msg);
      reject(new Error(msg));
    }, 15000);

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      fn();
    };

    try {
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      logWifiDiag("[WS] standard: new WebSocket() created, readyState=" + ws.readyState);
    } catch (e) {
      globalThis.clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : String(e);
      logWifiDiag("[WS] standard: ctor threw " + msg);
      onErrorCb?.(msg);
      reject(new Error(msg));
      return;
    }

    ws.onopen = () => {
      sawOpen = true;
      console.log("[WebSocket] Connected to", url);
      logWifiDiag("[WS] standard: onopen readyState=" + ws!.readyState);
      logSession("ws_standard_onopen", { url: url.slice(0, 96) });
      onConnectCb?.(url);
      done(() => resolve());
    };

    ws.onclose = (ev) => {
      logWifiDiag(
        `[WS] standard: onclose code=${ev.code} wasClean=${ev.wasClean} reason=${(ev.reason || "").slice(0, 80)} settled=${settled} sawOpen=${sawOpen}`
      );
      if (!settled) {
        const part = ev.reason?.trim() || `code ${ev.code}`;
        const msg = `Connection failed: ${part}`;
        done(() => {
          onErrorCb?.(msg);
          reject(new Error(msg));
        });
        return;
      }
      if (sawOpen) {
        notifyDisconnected();
      }
    };

    ws.onerror = () => {
      const msg = "Connection failed.";
      logWifiDiag("[WS] standard: onerror event");
      done(() => {
        onErrorCb?.(msg);
        reject(new Error(msg));
      });
    };

    ws.onmessage = (event) => {
      deliverWsMessageData(event.data);
    };
  });
}

export async function connect(urlOrHost: string, port?: number): Promise<void> {
  const url = buildWsUrl(urlOrHost, port);
  const nativeApp = await isCapacitorNativeApp();
  logSession("ws_connect begin", { native: nativeApp, url: url.slice(0, 100) });
  logWifiDiag(`[WS] connect() → ${url} capacitorNative=${nativeApp}`);

  if (nativeApp) {
    return connectNative(url);
  }

  return connectStandardWebSocket(url);
}

/**
 * Disconnect from the WebSocket server.
 */
export async function disconnect(): Promise<void> {
  await clearConnection();
  notifyDisconnected();
}

/**
 * Send raw bytes to the board (KV4P protocol frames).
 */
export async function write(data: Uint8Array): Promise<void> {
  wsTxDiagCount += 1;
  const tn = wsTxDiagCount;
  if (tn <= 50 || tn % 60 === 0) {
    logWifiDiag(`[WS] tx #${tn} ${previewBytesHex(data)}`);
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data);
    return;
  }
  if (await isCapacitorNativeApp()) {
    if (!nativeConnected) throw new Error("Not connected");
    const { CapacitorWebsocket } = await import("@miaz/capacitor-websocket");
    await CapacitorWebsocket.send({
      name: PLUGIN_SOCKET_NAME,
      data: uint8ArrayToBase64(data),
    });
    return;
  }
  throw new Error("Not connected");
}
