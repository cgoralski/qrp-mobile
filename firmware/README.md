# Firmware working copy (edit and build here)

This folder is your **working copy** of the KV4P ESP32 firmware. Use it for all edits and for building `firmware.bin`.

- **Open in PlatformIO:** open `firmware/microcontroller/` (the folder containing `platformio.ini`).
- **Open in Arduino IDE:** open `firmware/microcontroller/kv4p_ht_esp32_wroom_32/kv4p_ht_esp32_wroom_32.ino`.

The **pristine reference** (developer source + local stubs, unchanged) is in **`.original-poc/`** at the repo root. Do not edit that folder; use it only to compare or resync.

**WiFi:** The firmware includes an optional WiFi + WebSocket server (same KV4P protocol over `ws://<board-ip>:8765`). Set `WIFI_SSID` and `WIFI_PASS` in `kv4p_ht_esp32_wroom_32/wifi_ws.h` or via `platformio.ini` build_flags. If both are empty, WiFi is skipped. Join the board's AP (e.g. KV4P-Radio), then connect the app to ws://192.168.4.1:8765 (use the QRP Mobile native app for wireless on phone).
