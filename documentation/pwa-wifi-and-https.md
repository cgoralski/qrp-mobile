# PWA, HTTPS, and Wi‑Fi to the ESP32

If you use **QRP Mobile as a web app or installed PWA** (Safari / Chrome) loaded from **`https://…`** (for example `https://qrpmobile.vk4cgo.com`), the browser will **not** allow a WebSocket to the radio board at **`ws://192.168.4.1:8765`**.

That is **mixed content**: a secure page (HTTPS) is not allowed to open an **insecure WebSocket** (`ws://`) to another host or IP. The connection fails with a generic error (or is blocked before it starts). Your phone can be on **KV4P-Radio** Wi‑Fi and the ESP32 can be working; the block is entirely in the browser security model.

## What works

| How you run the app | Typical result for `ws://192.168.4.1:8765` |
|---------------------|-------------------------------------------|
| **Native iOS/Android** (Capacitor build in Xcode / Android Studio) | Allowed — not a browser mixed-content case. |
| **Web app over `http://`** on the same LAN (e.g. dev server, or future HTTP hosting on the board) | Usually allowed — page is not HTTPS. |
| **HTTPS PWA** from your public site | **Blocked** — use native app or HTTP origin. |

## Practical options

1. **Use the native app** for Wi‑Fi control (build with Xcode / Android Studio). See [`ios-local-build-and-deploy.md`](./ios-local-build-and-deploy.md).
2. **Development:** run the Vite dev server over **HTTP** (e.g. `http://<your-mac-ip>:8080`) on the LAN and open that URL on the phone while connected to KV4P-Radio — then `ws://` is not mixed with HTTPS.
3. **Future firmware:** serve the built `dist/` from the ESP32 over **HTTP** and open `http://192.168.4.1/` so the page and `ws://192.168.4.1:8765` are both non-TLS (would require firmware work).

## TLS on the board (`wss://`)

Supporting **`wss://`** on the ESP32 would allow HTTPS PWAs to connect, but that implies HTTPS certificates and more complexity on the microcontroller. The stock firmware uses plain **`ws://`**.

The web app detects the HTTPS + `ws://` case and shows an explicit error instead of a silent failure.
