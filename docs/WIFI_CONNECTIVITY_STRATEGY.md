# WiFi connectivity strategy (iPhone / cross‑platform)

**Status:** Adopted. USB and Bluetooth **audio** (and reliance on BLE for ongoing control) are on hold. This doc describes the WiFi-based path for iPhone and other clients.

---

## 1. Approach: BLE provision → WiFi + WebSocket

The following flow is **standard for IoT** and will work with your existing protocol and app:

1. **Connect to ESP32 via BLE** (one-time or when re-provisioning)  
   - Use the same Nordic UART Service (NUS) you already have in `ble-device.ts`.  
   - No audio over BLE; BLE is used only for **provisioning**.

2. **Send WiFi credentials to the board over BLE**  
   - SSID and password (and optionally static IP / hostname).  
   - You can use a small custom binary frame, or follow **ESP-IDF WiFi Provisioning** (BLE transport) so the board runs the standard Espressif provisioning flow.

3. **Board connects to local WiFi**  
   - ESP32 joins the given SSID, obtains an IP (DHCP or static).

4. **Drop the BLE connection**  
   - Once WiFi is up, the app disconnects BLE. The board can turn off BLE to save power.

5. **Use WebSockets over WiFi for control and audio**  
   - App connects to the board at `ws://<board-ip>:<port>` (or `wss://` if you add TLS later).  
   - **Same KV4P binary protocol**: frames (delimiter + cmd + paramLen + params) are sent as WebSocket binary messages. No protocol change; only the transport changes from serial/BLE to WebSocket.

This gives you:

- **iPhone compatibility**: no Web Serial, no BLE audio; WiFi + WebSocket work in Safari/PWA.
- **Better bandwidth**: WiFi is far more capable than BLE for Opus audio streaming.
- **Same app logic**: `DeviceConnectionContext` already abstracts the transport; you add a third transport type `"wifi"` that uses a WebSocket under the hood and still exposes `sendData` / `setOnData`.

---

## 2. What stays the same

- **KV4P protocol**: All existing commands (HELLO, CONFIG, VERSION, PTT, GROUP, TX_AUDIO, RX_AUDIO, etc.) and frame format are unchanged.
- **Handshake**: HELLO → STOP → CONFIG → VERSION over the WebSocket.
- **Audio**: Same Opus encode/decode and 40 ms framing; only the bytes are carried over the WebSocket instead of serial/BLE.
- **UI and Kv4pContext**: They already talk to `useDeviceConnection()`; once the WiFi transport is plugged in, they work without change.

---

## 3. What’s needed

### 3.1 ESP32 firmware

- **WiFi + BLE coexistence** (or BLE-only during provisioning):  
  - On first boot (or “provision” button): start BLE, advertise NUS (or Espressif provisioning), wait for credentials.  
  - On credentials received: connect to WiFi, then optionally stop BLE.
- **WebSocket server** on the ESP32 (e.g. on a fixed port, e.g. 80 or 8765):  
  - Accept a single client (or small number).  
  - Receive binary WebSocket frames and feed them into the **same** FrameParser / command handler you use for serial.  
  - Send outgoing frames (VERSION, RX_AUDIO, SMETER_REPORT, etc.) as WebSocket binary messages.  
- **Discovery (optional)**: mDNS so the app can find the board at `kv4p.local` instead of typing an IP.

Libraries: ESP-IDF has **esp_websocket_client** (client) and you can run a small WebSocket **server** on the ESP32 (e.g. using the HTTP server + WebSocket upgrade, or a lightweight WS server library).

### 3.2 Web app (implemented)

- **`src/lib/websocket-device.ts`**: e.g. `src/lib/websocket-device.ts` (or `wifi-device.ts`) that:  
  - Exposes the same shape as BLE/serial: `connect(urlOrHost)`, `disconnect()`, `write(data: Uint8Array)`, and callbacks `onConnect`, `onDisconnect`, `onError`, `onData`.  
  - On connect, open a WebSocket to `ws://<host>:<port>`, then forward `binaryMessage` → `onData` and `send(data)` → `ws.send(data)`.
- **DeviceConnectionContext**  
  - Add `connectionType: "wifi"` and e.g. `connectViaWifi(host: string, port?: number)`.  
  - When `connectionType === "wifi"`, `sendData` uses the WebSocket transport and `setOnData` receives from it.
- **Provisioning flow (optional but recommended)**  
  - Screen or modal: “Set up board on WiFi”.  
  - Connect via BLE → send SSID + password (custom frames or Espressif provisioning) → wait for “WiFi connected” (e.g. custom frame or HTTP/WS reachability) → disconnect BLE → prompt “Connect via WiFi” and either auto-connect to `kv4p.local` or show an input for IP/hostname.
- **Connection UI**  
  - “Connect via WiFi” entry point: if you have a saved host (or mDNS), connect directly; otherwise show “Enter IP/hostname” or “Provision board” first.

---

## 4. USB and BLE audio: on hold

- **USB (Web Serial)**: Remain in the codebase for desktop/Android where it works; not used for iPhone. No new USB audio work.
- **BLE for ongoing link**: Not used for control or audio after provisioning. BLE is only for sending WiFi credentials and optionally checking “WiFi connected” before switching to WiFi.
- **Bluetooth audio profile (A2DP/HFP)**: Not in scope; audio is Opus over the WebSocket (or over serial on Android/desktop).

---

## 5. Summary

| Step | Where | What |
|------|--------|------|
| 1 | iPhone / app | Connect to ESP32 via BLE (provisioning only). |
| 2 | App → ESP32 | Send WiFi credentials over BLE. |
| 3 | ESP32 | Join WiFi, then stop BLE. |
| 4 | App | Disconnect BLE. |
| 5 | App ↔ ESP32 | Control and audio over WebSockets on local WiFi (same KV4P protocol). |

This approach is sound and aligns with common IoT patterns (e.g. smart home devices). Next concrete steps: implement the WebSocket server on the ESP32 and the WebSocket transport + “Connect via WiFi” (and optionally provisioning) in the web app.

---

## 6. Field operations: cloud data on iPhone (KV4P-Radio + cellular)

The **KV4P-Radio** SSID is for **LAN** access to the board (WebSocket). It typically has **no internet**. For the **native iPhone app**, teams should **keep cellular data on** and **allow** iOS to use cellular when prompted while on that Wi‑Fi, so **Supabase** (repeaters, contacts sync) and **map tile** CDNs stay reachable. That is the **standard operating configuration** for up-to-date repeater lists and basemaps.

See **[WIFI_INTERNET_QA.md](./WIFI_INTERNET_QA.md)** for the full policy, QA matrix, and app mitigations (offline banners, caches, map fallback).
