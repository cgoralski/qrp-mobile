/**
 * WiFi provisioning over BLE: send SSID + password to ESP32, receive board IP.
 * Uses a separate BLE connection (does not touch the main app BLE/serial state).
 * Frame format matches KV4P: [0xDE,0xAD,0xBE,0xEF] [cmd 1] [paramLen 2 LE] [params...]
 */

const DELIMITER = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const DELIMITER_LENGTH = 4;

/** App → ESP32: set WiFi credentials. Params: [ssidLen 1][ssid...][passwordLen 1][password...] */
export const PROV_CMD_SET_WIFI = 0xa0;
/** ESP32 → App: report board IP. Params: [ipLen 1][ip UTF-8] */
export const PROV_CMD_WIFI_IP = 0xa1;

const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_CHAR_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_CHAR_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const MAX_SSID_LEN = 32;
const MAX_PASSWORD_LEN = 64;
const PROV_TIMEOUT_MS = 60000;

function buildPacket(cmd: number, params: Uint8Array): Uint8Array {
  const plen = params.length;
  const packet = new Uint8Array(DELIMITER_LENGTH + 1 + 2 + plen);
  packet.set(DELIMITER, 0);
  packet[4] = cmd;
  packet[5] = plen & 0xff;
  packet[6] = (plen >> 8) & 0xff;
  packet.set(params, 7);
  return packet;
}

/**
 * Build SET_WIFI frame. SSID and password encoded as length-prefixed UTF-8.
 */
export function buildSetWifiPacket(ssid: string, password: string): Uint8Array {
  const ssidBytes = new TextEncoder().encode(ssid.slice(0, MAX_SSID_LEN));
  const passwordBytes = new TextEncoder().encode(password.slice(0, MAX_PASSWORD_LEN));
  const params = new Uint8Array(1 + ssidBytes.length + 1 + passwordBytes.length);
  params[0] = ssidBytes.length;
  params.set(ssidBytes, 1);
  params[1 + ssidBytes.length] = passwordBytes.length;
  params.set(passwordBytes, 2 + ssidBytes.length);
  return buildPacket(PROV_CMD_SET_WIFI, params);
}

/**
 * Parse WIFI_IP report params: first byte = length, rest = UTF-8 IP string.
 */
export function parseWifiIpParams(params: Uint8Array): string | null {
  if (params.length < 2) return null;
  const len = params[0];
  if (len <= 0 || 1 + len > params.length) return null;
  return new TextDecoder().decode(params.subarray(1, 1 + len));
}

/**
 * Accumulate BLE chunks and look for a frame with cmd === PROV_CMD_WIFI_IP.
 * Returns the IP string when found, or null if buffer doesn't contain a full matching frame yet.
 */
function extractWifiIpFromBuffer(buffer: Uint8Array): { ip: string; consumed: number } | null {
  if (buffer.length < 7) return null;
  let offset = 0;
  while (offset <= buffer.length - 7) {
    if (
      buffer[offset] === 0xde &&
      buffer[offset + 1] === 0xad &&
      buffer[offset + 2] === 0xbe &&
      buffer[offset + 3] === 0xef
    ) {
      const cmd = buffer[offset + 4];
      const plen = buffer[offset + 5] | (buffer[offset + 6] << 8);
      const frameEnd = offset + 7 + plen;
      if (frameEnd > buffer.length) return null;
      if (cmd === PROV_CMD_WIFI_IP && plen >= 1) {
        const params = buffer.subarray(offset + 7, frameEnd);
        const ip = parseWifiIpParams(params);
        if (ip) return { ip, consumed: frameEnd };
      }
      offset = frameEnd;
    } else {
      offset++;
    }
  }
  return null;
}

export function isProvisioningSupported(): boolean {
  if (typeof navigator === "undefined" || !("bluetooth" in navigator)) return false;
  if (typeof window !== "undefined" && !window.isSecureContext) return false;
  return true;
}

export interface ProvisioningConnection {
  /** Send WiFi credentials; resolves with board IP when board has joined WiFi. */
  sendCredentials(ssid: string, password: string): Promise<string>;
  /** Disconnect BLE. */
  close(): void;
}

/**
 * Open a BLE connection for provisioning (NUS). Use sendCredentials() then close().
 * Does not affect the main app BLE/serial state.
 */
export async function openProvisioningConnection(): Promise<ProvisioningConnection> {
  if (!isProvisioningSupported()) {
    throw new Error("Bluetooth is not available. Use HTTPS and a supported browser.");
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [NUS_SERVICE_UUID] }],
    optionalServices: [NUS_SERVICE_UUID],
  });

  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(NUS_SERVICE_UUID);
  const rxChar = await service.getCharacteristic(NUS_CHAR_RX_UUID);
  const txChar = await service.getCharacteristic(NUS_CHAR_TX_UUID);
  await txChar.startNotifications();

  let buffer = new Uint8Array(0);
  let closed = false;

  const connection: ProvisioningConnection = {
    sendCredentials(ssid: string, password: string): Promise<string> {
      if (closed) return Promise.reject(new Error("Provisioning connection closed."));
      const packet = buildSetWifiPacket(ssid, password);

      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for board to connect to WiFi."));
        }, PROV_TIMEOUT_MS);

        const handler = (event: Event) => {
          const char = event.target as BluetoothRemoteGATTCharacteristic;
          const value = char.value;
          if (!value || value.byteLength === 0) return;
          const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          const newBuf = new Uint8Array(buffer.length + chunk.length);
          newBuf.set(buffer);
          newBuf.set(chunk, buffer.length);
          buffer = newBuf;
          const result = extractWifiIpFromBuffer(buffer);
          if (result) {
            clearTimeout(timeout);
            txChar.removeEventListener("characteristicvaluechanged", handler);
            resolve(result.ip);
          }
        };

        txChar.addEventListener("characteristicvaluechanged", handler);
        rxChar.writeValue(packet).catch((err) => {
          clearTimeout(timeout);
          txChar.removeEventListener("characteristicvaluechanged", handler);
          reject(err);
        });
      });
    },
    close() {
      closed = true;
      server.disconnect();
    },
  };

  return connection;
}

/**
 * Run full WiFi provisioning in one go: connect BLE, send credentials, wait for IP, disconnect.
 * Convenience when you don't need to show a form after BLE connect.
 */
export async function runWifiProvisioning(ssid: string, password: string): Promise<string> {
  const conn = await openProvisioningConnection();
  try {
    const ip = await conn.sendCredentials(ssid, password);
    return ip;
  } finally {
    conn.close();
  }
}
