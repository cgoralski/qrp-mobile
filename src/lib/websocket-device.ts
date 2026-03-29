/**
 * WebSocket client transport for KV4P-HT over WiFi.
 * - Browser / Capacitor iOS: WKWebView `WebSocket` (ws:// to the board works; avoids Starscream plugin issues).
 * - Capacitor Android: @miaz/capacitor-websocket (cleartext / WebView quirks).
 * Firmware sends KV4P frames as WebSocket TEXT (base64) and accepts BIN or TEXT; see wifi_ws.cpp.
 */

const DEFAULT_WS_PORT = 8765;
const PLUGIN_SOCKET_NAME = "board";

let ws: WebSocket | null = null;
let nativeConnected = false;
let pluginListeners: Array<{ remove: () => Promise<void> }> = [];

let onConnectCb: ((url: string) => void) | null = null;
let onDisconnectCb: (() => void) | null = null;
let onErrorCb: ((message: string) => void) | null = null;
let onDataCb: ((data: Uint8Array) => void) | null = null;

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Android uses the Capacitor plugin; iOS uses WKWebView WebSocket (more reliable to ws:// LAN). */
async function shouldUseNativeWebsocketPlugin(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

async function clearConnection(): Promise<void> {
  if (ws) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    ws = null;
  }
  const native = await isNative();
  if (native) {
    nativeConnected = false;
    for (const h of pluginListeners) {
      try {
        await h.remove();
      } catch {
        /* ignore */
      }
    }
    pluginListeners = [];
    try {
      const { CapacitorWebsocket } = await import("@miaz/capacitor-websocket");
      await CapacitorWebsocket.disconnect({ name: PLUGIN_SOCKET_NAME });
    } catch {
      /* ignore */
    }
  }
}

function notifyDisconnected() {
  console.log("[WebSocket] Disconnected");
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

  await clearConnection();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Connection timeout"));
      onErrorCb?.("Connection timeout.");
    }, 15000);

    const onConnected = () => {
      clearTimeout(timeout);
      nativeConnected = true;
      console.log("[WebSocket] Connected to", url);
      onConnectCb?.(url);
      resolve();
    };
    const onConnectError = (event: { exception?: string }) => {
      clearTimeout(timeout);
      const msg = event?.exception ?? "Connection failed.";
      onErrorCb?.(msg);
      reject(new Error(msg));
    };

    (async () => {
      try {
        await CapacitorWebsocket.build({ name: PLUGIN_SOCKET_NAME, url });
        // iOS native: Starscream callbacks are only registered when applyListeners runs (see plugin Swift).
        await CapacitorWebsocket.applyListeners({ name: PLUGIN_SOCKET_NAME });

        const hMessage = await CapacitorWebsocket.addListener(
          `${PLUGIN_SOCKET_NAME}:message`,
          (event: { data: string }) => {
            try {
              const bytes = base64ToUint8Array(event.data);
              onDataCb?.(bytes);
            } catch {
              /* ignore decode errors */
            }
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
            nativeConnected = false;
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
      } catch (e) {
        clearTimeout(timeout);
        const msg = e instanceof Error ? e.message : String(e);
        onErrorCb?.(msg);
        reject(e);
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
  if (data instanceof ArrayBuffer) {
    onDataCb(new Uint8Array(data));
    return;
  }
  if (typeof data === "string") {
    try {
      onDataCb(base64ToUint8Array(data));
    } catch {
      /* ignore invalid base64 */
    }
    return;
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    void data.arrayBuffer().then((buf) => deliverWsMessageData(buf));
  }
}

/**
 * Standard WebSocket (browser or Capacitor iOS WKWebView).
 */
async function connectStandardWebSocket(url: string): Promise<void> {
  if (!isWifiSupported()) {
    onErrorCb?.("WebSocket is not supported in this browser.");
    return Promise.reject(new Error("WebSocket is not supported"));
  }

  await clearConnection();

  const mixed = getBrowserWsMixedContentBlockedMessage();
  if (mixed && url.startsWith("ws://")) {
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
    } catch (e) {
      globalThis.clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : String(e);
      onErrorCb?.(msg);
      reject(new Error(msg));
      return;
    }

    ws.onopen = () => {
      sawOpen = true;
      console.log("[WebSocket] Connected to", url);
      onConnectCb?.(url);
      done(() => resolve());
    };

    ws.onclose = (ev) => {
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

  if (await shouldUseNativeWebsocketPlugin()) {
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
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data);
    return;
  }
  if (await shouldUseNativeWebsocketPlugin()) {
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
