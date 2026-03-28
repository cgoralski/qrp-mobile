/**
 * Web Bluetooth connection to KV4P-HT (Nordic UART Service).
 * Use this to connect, disconnect, and send/receive data over BLE.
 */

const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_CHAR_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // host → device (write)
const NUS_CHAR_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // device → host (notify)

let device: BluetoothDevice | null = null;
let server: BluetoothRemoteGATTServer | null = null;
let rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

let onConnectCb: ((deviceName: string) => void) | null = null;
let onDisconnectCb: (() => void) | null = null;
let onErrorCb: ((message: string) => void) | null = null;
let onDataCb: ((data: Uint8Array) => void) | null = null;

/** Serialize all GATT writes; Web Bluetooth allows only one operation at a time. */
let writeQueue: Promise<void> = Promise.resolve();

function clearConnection() {
  device = null;
  server = null;
  rxCharacteristic = null;
  txCharacteristic = null;
  writeQueue = Promise.resolve();
}

function notifyDisconnected() {
  console.log("[BLE] Disconnected");
  clearConnection();
  onDisconnectCb?.();
}

export function isBluetoothSupported(): boolean {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) return false;
  if (typeof window !== "undefined" && !window.isSecureContext) return false;
  return true;
}

export function isConnected(): boolean {
  return server?.connected ?? false;
}

export function getDeviceName(): string | null {
  return device?.name ?? null;
}

export function setCallbacks(callbacks: {
  onConnect?: (deviceName: string) => void;
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
 * Connect to a BLE device advertising the Nordic UART Service (e.g. KV4P-HT).
 * Requires HTTPS (or localhost). User will be prompted to choose a device.
 */
export async function connect(): Promise<void> {
  if (!isBluetoothSupported()) {
    const msg =
      typeof window !== "undefined" && !window.isSecureContext
        ? "Web Bluetooth requires HTTPS or localhost."
        : "Bluetooth is not supported. Use HTTPS and a supported browser.";
    onErrorCb?.(msg);
    return;
  }

  try {
    const chosen = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE_UUID] }],
      optionalServices: [NUS_SERVICE_UUID],
    });

    device = chosen;

    device.addEventListener("gattserverdisconnected", () => {
      notifyDisconnected();
    });

    server = await device.gatt!.connect();
    const service = await server.getPrimaryService(NUS_SERVICE_UUID);

    rxCharacteristic = await service.getCharacteristic(NUS_CHAR_RX_UUID);
    txCharacteristic = await service.getCharacteristic(NUS_CHAR_TX_UUID);

    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener("characteristicvaluechanged", (event: Event) => {
      try {
        const char = event.target as BluetoothRemoteGATTCharacteristic;
        const value = char.value;
        if (value && onDataCb) {
          const buf = value.buffer;
          const start = value.byteOffset;
          const len = value.byteLength;
          onDataCb(new Uint8Array(buf, start, len));
        }
      } catch (err) {
        console.error("[BLE] Error in data callback:", err);
      }
    });

    console.log("[BLE] Connected, notifications started");
    onConnectCb?.(device.name ?? "KV4P-HT");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User cancelled") || message.includes("canceled")) {
      onErrorCb?.("Connection cancelled.");
    } else {
      onErrorCb?.(message);
    }
    clearConnection();
    throw err;
  }
}

/**
 * Disconnect from the current device.
 */
export async function disconnect(): Promise<void> {
  if (server?.connected) {
    server.disconnect();
  }
  notifyDisconnected();
}

/**
 * Send raw bytes to the device (e.g. KV4P protocol frames).
 * Writes are queued so only one GATT write runs at a time.
 */
export async function write(data: Uint8Array): Promise<void> {
  const char = rxCharacteristic;
  if (!char) {
    throw new Error("Not connected");
  }
  const prev = writeQueue;
  let resolve: () => void;
  writeQueue = new Promise<void>((r) => {
    resolve = r;
  });
  await prev;
  try {
    await char.writeValue(data);
  } finally {
    resolve!();
  }
}
