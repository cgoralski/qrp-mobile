# KV4P-HT Project Specification

**Version:** 1.0  
**Purpose:** Comprehensive technical specification for rebuilding the KV4P-HT handheld ham radio system on the same or a different mobile phone platform.  
**Project site:** https://kv4p.com  
**License:** GPL-3.0 (see repository)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Binary Protocol (Phone ↔ ESP32)](#3-binary-protocol-phone--esp32)
4. [Mobile Application Specification](#4-mobile-application-specification)
5. [UI and Service Interaction](#5-ui-and-service-interaction)
6. [ESP32 Firmware Specification](#6-esp32-firmware-specification)
7. [Audio Pipeline](#7-audio-pipeline)
8. [RF Module and Hardware](#8-rf-module-and-hardware)
9. [Build and Deployment](#9-build-and-deployment)
10. [Porting to Another Mobile Platform](#10-porting-to-another-mobile-platform)

---

## 1. Project Overview

KV4P-HT is an open-source handheld ham radio. The system has three main parts:

| Component | Role |
|----------|------|
| **Mobile app** | User interface, channel/repeater management, APRS, audio capture/playback, Opus encode/decode, and all communication with the board over USB serial. |
| **ESP32 board (IoT dongle)** | Connects to the phone via USB; runs the same binary protocol; drives the RF module (frequency, PTT, squelch, CTCSS); handles Opus ↔ I2S/ADC for TX and RX audio. |
| **DRA818/SA818 RF module** | Actual VHF/UHF transceiver (transmitter and receiver) controlled by the ESP32 over UART and GPIO. |

The phone does **not** transmit radio waves. The **board** talks to the phone over USB and drives the **RF module**, which does the actual radio TX/RX.

---

## 2. System Architecture

The following diagram shows the **control flow** from the host app down to the RF module: host (UI + radio layer) talks over USB serial to the ESP32 board, which in turn drives the RF module over UART and audio.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                                  │
│  ┌─────────────────┐  ┌──────────────────────────────────────────────────┐ │
│  │ UI (Activities/ │  │ Radio service (background / foreground)           │ │
│  │ Screens)        │  │ • USB serial open/close, 115200 8N1                │ │
│  │ • Main (voice)  │  │ • Protocol: FrameParser + Sender                  │ │
│  │ • Settings      │  │ • Handshake: HELLO → CONFIG → VERSION              │ │
│  │ • Memories     │  │ • Opus encoder (TX) / decoder (RX)                 │ │
│  │ • APRS / Chat   │  │ • AudioTrack (play RX), AudioRecord (capture TX)    │ │
│  │ • Firmware     │  │ • AFSK 1200 modem (APRS), flow control             │ │
│  └────────┬────────┘  └───────────────────────────┬────────────────────────┘ │
│           │ bind + callbacks                       │                          │
│           └──────────────────────────────────────┘                          │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ USB host (serial)
                                │ VID/PID filter (see §4.2)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ESP32 BOARD (USB device)                                                     │
│  • Serial @ 115200 (USB CDC or UART bridge: CP210x, CH34x, etc.)             │
│  • protocol.h: FrameParser, handleCommands(), send*()                         │
│  • txAudio: Opus decode → I2S PDM → RF module mic                             │
│  • rxAudio: ADC ← RF module speaker → Opus encode → COMMAND_RX_AUDIO         │
│  • Serial2 @ 9600 → DRA818/SA818 (group, filters, volume, RSSI poll)          │
│  • GPIO: PTT, PD, SQ, optional HL, optional physical PTT buttons            │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ UART + I2S + ADC + GPIO
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RF MODULE (DRA818V / SA818 VHF or UHF)                                       │
│  • Frequency, CTCSS, squelch, bandwidth, pre/de-emphasis, high/low pass       │
│  • Actual radio transmitter and receiver                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Simplified control flow (same logical flow in all implementations):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Android phone (KV4P HT app)                                     │
│  • MainActivity, Settings, Find Repeaters, APRS, channel memory │
│  • RadioAudioService (foreground): USB serial, Opus, AFSK, APRS  │
│  • Protocol + ProtocolHandshake (binary frames over serial)      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ USB serial (115200 baud)
                            │ CP210x / CH34x / etc. (device_filter.xml)
┌───────────────────────────▼─────────────────────────────────────┐
│  IoT board (ESP32-WROOM-32)                                      │
│  • protocol.h + FrameParser: same binary protocol                 │
│  • handleCommands(): PTT, group, filters, config, TX audio, etc. │
│  • txAudio: Opus decode → I2S/PDM → RF module mic input          │
│  • rxAudio: ADC → Opus encode → COMMAND_RX_AUDIO → host          │
│  • Serial2 (9600): DRA818/SA818 UART control                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ UART (GPIO) + I2S/ADC (audio)
┌───────────────────────────▼─────────────────────────────────────┐
│  RF module: DRA818V (VHF) or SA818 (VHF/UHF)                     │
│  • Actual radio TX/RX; CTCSS, squelch, filters, RSSI              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Binary Protocol (Phone ↔ ESP32)

The protocol is **symmetric**: both sides send **frames** of the same structure.  
**Byte order:** little-endian for all multi-byte fields.  
**Direction naming:** “Host” = phone (Android); “ESP32” = board.

### 3.1 Frame Format

Every frame is:

| Field | Size (bytes) | Description |
|-------|--------------|-------------|
| Delimiter | 4 | Fixed `0xDE 0xAD 0xBE 0xEF` |
| Command   | 1 | Command code (see tables below) |
| Param len | 2 | Length of Parameters (0–65535), little-endian |
| Params    | 0–2048 | Command-specific payload (`PROTO_MTU = 2048`) |

So total frame size = 4 + 1 + 2 + param_len = **7 + param_len** bytes minimum.

### 3.2 Commands: Host (Phone) → ESP32

| Code (hex) | Name | Params | Description |
|------------|------|--------|-------------|
| 0x01 | COMMAND_HOST_PTT_DOWN | — | Start transmit (key PTT) |
| 0x02 | COMMAND_HOST_PTT_UP | — | End transmit |
| 0x03 | COMMAND_HOST_GROUP | Group (12 B) | Set frequency, bandwidth, CTCSS, squelch |
| 0x04 | COMMAND_HOST_FILTERS | Filters (1 B) | Set pre/de-emphasis, highpass, lowpass |
| 0x05 | COMMAND_HOST_STOP | — | Stop (leave RX; stop tuning) |
| 0x06 | COMMAND_HOST_CONFIG | Config (1 B) | Power config; ESP32 replies with COMMAND_VERSION |
| 0x07 | COMMAND_HOST_TX_AUDIO | byte[] | Opus-encoded TX audio (flow-controlled) |
| 0x08 | COMMAND_HOST_HL | HlState (1 B) | High/low power (if hardware supports) |
| 0x09 | COMMAND_HOST_RSSI | RSSIState (1 B) | Enable/disable RSSI reports |

### 3.3 Commands: ESP32 → Host (Phone)

| Code (hex) | Name | Params | Description |
|------------|------|--------|-------------|
| 0x53 | COMMAND_SMETER_REPORT | Rssi (1 B) | RSSI value 0–255 (map to S-units in UI) |
| 0x44 | COMMAND_PHYS_PTT_DOWN | — | Physical PTT button pressed |
| 0x55 | COMMAND_PHYS_PTT_UP | — | Physical PTT button released |
| 0x01 | COMMAND_DEBUG_INFO | char[] | Log at INFO level |
| 0x02 | COMMAND_DEBUG_ERROR | char[] | Log at ERROR level |
| 0x03 | COMMAND_DEBUG_WARN | char[] | Log at WARN level |
| 0x04 | COMMAND_DEBUG_DEBUG | char[] | Log at DEBUG level |
| 0x05 | COMMAND_DEBUG_TRACE | char[] | Log at TRACE level |
| 0x06 | COMMAND_HELLO | — | Boot/hello; host starts handshake |
| 0x07 | COMMAND_RX_AUDIO | byte[] | Opus-encoded RX audio |
| 0x08 | COMMAND_VERSION | Version (see below) | Firmware version and capabilities |
| 0x09 | COMMAND_WINDOW_UPDATE | WindowUpdate (4 B) | Flow-control window replenishment |

### 3.4 Parameter Structures (Layout and Byte Order: LE)

All structs are packed; no padding. Sizes must match on both sides.

**Group** (12 bytes) – COMMAND_HOST_GROUP:

| Offset | Type | Field | Description |
|--------|------|-------|-------------|
| 0 | uint8_t | bw | 0x00 = 12.5 kHz, 0x01 = 25 kHz |
| 1 | float | freq_tx | TX frequency (MHz) |
| 5 | float | freq_rx | RX frequency (MHz) |
| 9 | uint8_t | ctcss_tx | CTCSS index (0 = none; see tone table) |
| 10 | uint8_t | squelch | Squelch level (0–8 typical) |
| 11 | uint8_t | ctcss_rx | CTCSS index for RX |

**Filters** (1 byte) – COMMAND_HOST_FILTERS:

- Bit 0 (0x01): pre/de-emphasis (pre)
- Bit 1 (0x02): highpass
- Bit 2 (0x04): lowpass

**Config** (1 byte) – COMMAND_HOST_CONFIG:

- 1 byte: `isHigh` (0 = low power, non-zero = high power)

**HlState** (1 byte) – COMMAND_HOST_HL:

- 1 byte: `isHigh` (0 = low, non-zero = high)

**RSSIState** (1 byte) – COMMAND_HOST_RSSI:

- 1 byte: `on` (0 = disable RSSI reports, non-zero = enable)

**Rssi** (1 byte) – COMMAND_SMETER_REPORT:

- 1 byte: raw RSSI 0–255. App may map to S1–S9 (e.g. formula: `9.73*ln(0.0297*val)-1.88`, clamp 1–9).

**Version** (12 bytes) – COMMAND_VERSION:

| Offset | Type | Field | Description |
|--------|------|-------|-------------|
| 0 | uint16_t | ver | Firmware version (e.g. 15) |
| 2 | char | radioModuleStatus | 'f' = found, 'x' = not found, 'u' = unknown |
| 3 | uint32_t (size_t) | windowSize | Receive window size for flow control |
| 7 | uint8_t (RfModuleType) | rfModuleType | 0 = VHF, 1 = UHF |
| 8 | uint8_t | features | Bit 0 = has HL, Bit 1 = has physical PTT |

**WindowUpdate** (4 bytes) – COMMAND_WINDOW_UPDATE:

- 4 bytes: `size` (uint32_t) – bytes to add back to the host’s send window.

### 3.5 Flow Control

- ESP32 sends initial **window size** in `COMMAND_VERSION` (e.g. 2048).
- Host tracks a **send window**; each sent frame (including delimiter+cmd+len+params) **decrements** the window by the frame size.
- When the window would go negative or below the next frame size, the host **blocks** sending until it receives `COMMAND_WINDOW_UPDATE`.
- ESP32 sends `COMMAND_WINDOW_UPDATE(size)` after **processing** each received frame; `size` is typically the size of that frame (7 + param_len), so the host can send again.
- This avoids overrunning the ESP32’s USB/serial receive buffer, especially for `COMMAND_HOST_TX_AUDIO` and bursty APRS data.

### 3.6 Frame Parser (State Machine)

Both sides use the same logic:

1. Search for the 4-byte delimiter in the stream (reset on any mismatch).
2. After delimiter: read 1 byte → command.
3. Read 2 bytes (LE) → param_len.
4. Read param_len bytes → params.
5. Dispatch command with params; then (on ESP32) send COMMAND_WINDOW_UPDATE for this frame size.
6. Reset and look for the next delimiter.

If param_len > PROTO_MTU (2048), discard the frame and reset the parser.

---

## 4. Mobile Application Specification

This section is platform-agnostic where possible; Android is used as the reference implementation.

### 4.1 Required Capabilities

The mobile app must provide:

- **USB host (serial)**  
  Open a single serial port to the ESP32 at **115200 8N1**. No parity, one stop bit.
- **Device discovery**  
  Enumerate USB devices and select the one that matches the board’s serial chip (see §4.2).
- **Background (or foreground) execution**  
  Radio and audio must continue when the app is in background or screen off; use a persistent “radio” service and, on Android, a foreground notification and wake lock.
- **Audio capture**  
  Microphone at **48 kHz, mono**, float or 16-bit PCM (then convert to the format expected by the Opus encoder).
- **Audio playback**  
  Playback at **48 kHz, mono**, low-latency path for RX audio.
- **Opus**  
  Encode TX audio and decode RX audio; frame size **1920 samples** (40 ms at 48 kHz), mono, narrowband VoIP profile. MTU for encoded frame ≤ 2048 bytes.
- **Permissions**  
  At least: USB, microphone, (for APRS) location, notifications, and any platform-specific “foreground service” or “background audio” permissions.

### 4.2 USB Device Filter (Reference: Android)

The app must only connect to the board’s USB serial interface. Typical VID/PID pairs:

| Vendor ID (decimal) | Product ID (decimal) | Typical chip |
|--------------------|------------------------|--------------|
| 4292  | 60000 | Silicon Labs CP210x |
| 9114  | 33041 | (check board) |
| 6790  | 29987 | CH340 |

On Android these are declared in `res/xml/device_filter.xml` and used for `USB_DEVICE_ATTACHED`; the same IDs can be used on another platform to pick the correct serial port.

### 4.3 Service / Backend Component (Logical)

A single long-lived “radio” component must:

1. **On start**
   - Enumerate USB serial; open the first matching device at 115200 8N1.
   - Set RTS/DTR if supported (some boards need this for stable operation).
   - Start a read loop: raw bytes → FrameParser → handleParsedCommand (see §3.6 and §5.2).
   - Create a **Sender** that writes frames (delimiter + cmd + len + params) and respects flow control (window).
   - Run **handshake** (see §4.4).
2. **After handshake**
   - Apply initial config (filters, high/low power, RSSI on/off) from app settings.
   - Tune to initial frequency or channel memory (send COMMAND_HOST_GROUP).
   - Start playing RX audio (decode Opus → play) and, when PTT is active, capture mic → encode Opus → COMMAND_HOST_TX_AUDIO.
3. **Ongoing**
   - Handle COMMAND_PHYS_PTT_DOWN/UP like app PTT (start/stop TX).
   - Handle COMMAND_SMETER_REPORT → update UI S-meter.
   - Handle COMMAND_RX_AUDIO → decode → play and optionally feed AFSK demodulator for APRS.
   - On disconnect/error: close port, clear Sender, notify UI (“radio missing”), optionally retry discovery.

**Buffer sizes (reference):**  
Write buffer large enough that the ESP32 can absorb bursts (e.g. 90 KB). Read buffer non-zero (e.g. 1024 bytes) with multiple buffers (e.g. 16×2) to avoid blocking the read loop.

### 4.4 Handshake (Host)

1. Wait for **COMMAND_HELLO** from ESP32 (with timeout, e.g. 1 s). If timeout, treat as no device or wrong firmware.
2. Send **COMMAND_HOST_STOP** (optional but recommended to clear any previous state).
3. Send **COMMAND_HOST_CONFIG** with current high/low power setting.
4. Wait for **COMMAND_VERSION** (timeout e.g. 60 s).
5. Parse Version:
   - If `ver` < minimum required firmware version (e.g. 15), show “firmware too old” and do not use radio.
   - If `radioModuleStatus` == 'x', show “radio module not found”.
   - Store `windowSize` and set the Sender’s flow-control window to this value.
   - Store `rfModuleType` (VHF/UHF), `features` (has HL, has physical PTT) for UI and behavior.
6. Mark “radio connected”; apply filters, RSSI, then tune to initial channel/frequency.

### 4.5 Data Models and Persistence (Reference)

- **Channel memory**  
  Per channel: name, frequency (string "xxx.xxxx"), offset (none / up / down), offset kHz (e.g. 600), tx_tone, rx_tone (string or "None"), group, skip_during_scan. Stored in a local DB (e.g. Room on Android).
- **App settings** (key/value)  
  lastGroup, lastMemoryId, lastFreq, min/max 2 m and 70 cm TX freqs, rfPower, bandwidth (e.g. "25kHz"/"12.5kHz"), micGainBoost, squelch, emphasis, highpass, lowpass, disableAnimations, aprsPositionAccuracy, aprsBeaconPosition, callsign, stickyPTT. Persisted and applied on startup and when returning from Settings.

### 4.6 Permissions and Intents (Android Reference)

- Permissions: `USB host`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `POST_NOTIFICATIONS`, `ACCESS_FINE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `INTERNET`, `ACCESS_DOWNLOAD_MANAGER`, `WRITE_EXTERNAL_STORAGE`.
- Main activity is the launcher and handles `USB_DEVICE_ATTACHED` with the same device filter.
- Foreground service type: `location | mediaPlayback` for the radio service.
- Intents: e.g. `OPEN_CHAT_ACTION`, `SETTINGS_ACTION`, `ADD_MEMORY_ACTION`, `EDIT_MEMORY_ACTION`, `FIND_REPEATERS`, `FIRMWARE_ACTION`, `STOP_RADIO_SERVICE`, `SERVICE_STOPPING`.

---

## 5. UI and Service Interaction

This section describes how the **UI** drives and reacts to the **radio service** so you can replicate the same contract on another platform.

### 5.1 Lifecycle and Binding

- **Start:** When the main UI becomes active (e.g. onStart), it starts the foreground radio service (if not already running) and **binds** to it. The service is started with an Intent that carries: `callsign`, `squelch`, `activeMemoryId`, `activeFrequencyStr`.
- **Binding:** The UI holds a reference to the service (or a “radio controller” interface) and registers **callbacks** for events (see §5.3).
- **Unbind:** On UI destroy, the app unbinds from the service; the service can keep running in foreground until the user stops it (e.g. via notification action).

### 5.2 Methods the UI Calls on the Service

These are the operations the UI triggers; the service translates them into protocol commands.

| Method | Purpose |
|--------|--------|
| `start()` | Called after bind; service finds USB device, opens serial, starts parser and handshake. |
| `tuneToFreq(frequencyStr, squelchLevel, forceTune)` | Tune to simplex frequency (e.g. "146.5200"). Sends COMMAND_HOST_GROUP with freq_tx = freq_rx, no CTCSS; updates internal activeFrequencyStr and clears activeMemoryId. |
| `tuneToMemory(memoryId, squelchLevel, forceTune)` | Load channel from DB by id, then tune with tx/rx freq, offset, CTCSS from channel; send COMMAND_HOST_GROUP. |
| `tuneToMemory(channelMemory, squelchLevel, forceTune)` | Same using a channel object (frequency, offset, offsetKhz, txTone, rxTone). |
| `setActiveMemoryId(id)` | Set current channel id; if id >= 0 call tuneToMemory(id, squelch, false), else tuneToFreq(activeFrequencyStr, squelch, false). |
| `startPtt()` | If mode is RX and tx allowed: set mode TX, start runaway timer, send COMMAND_HOST_PTT_DOWN, mute RX playback, notify UI (txStarted). |
| `endPtt()` | If mode is TX: set mode RX, send COMMAND_HOST_PTT_UP, notify UI (txEnded). |
| `setFilters(emphasis, highpass, lowpass)` | Send COMMAND_HOST_FILTERS with flags byte. |
| `setHighPower(high)` | Send COMMAND_HOST_HL with isHigh. |
| `setRssi(on)` | Send COMMAND_HOST_RSSI with on. |
| `setMode(mode)` | Set internal RadioMode (STARTUP, RX, TX, SCAN, BAD_FIRMWARE, FLASHING). FLASHING can trigger DTR/RTS to enter bootloader. |
| `setSquelch(level)` | Store squelch; next tune will use it. |
| `setCallsign(callsign)` | For APRS and beacons. |
| `setChannelMemories(liveDataOrList)` | Provide channel list for scan and “tune to memory” (needed for nextScan and applySettings). |
| `sendAudioToESP32(float[] samples, boolean dataMode)` | Encode samples with Opus and send COMMAND_HOST_TX_AUDIO. If not dataMode, apply mic gain. Called by UI (or internal loop) while PTT is held. |
| `setScanning(scanning)` / `setScanning(scanning, goToRxMode)` | Enter/exit SCAN mode; scan advances through channel list with timing/silence; each step is tuneToMemory(next). |
| `setBandwidth(bw)` | e.g. "25kHz" or "12.5kHz"; used in next COMMAND_HOST_GROUP. |
| `setMicGainBoost(value)` | NONE / low / high; applied in sendAudioToESP32. |
| `setAprsBeaconPosition(enabled)` | Start/stop periodic position beacon (e.g. every 5 min). |
| `reconnectViaUSB()` | Trigger device discovery and setup again. |

Settings applied on startup (from persisted key/value):

- **applyRfPowerSetting** → setHighPower
- **applySquelchSettings** → setSquelch
- **applyCallSignSetting** → setCallsign
- **applyGroupAndMemorySettings** → setActiveMemoryId or tuneToFreq/tuneToMemory with last memory/freq
- **applyTxFreqLimitsSettings** → setMin2mTxFreq, setMax2mTxFreq, setMin70cmTxFreq, setMax70cmTxFreq, updateFrequencyLimitsForBand
- **applyBandwidthAndGainSettings** → setBandwidth, setMicGainBoost
- **applyFiltersSettings** → setFilters(emphasis, highpass, lowpass)

### 5.3 Callbacks the Service Invokes on the UI

The UI implements a “callbacks” interface (or equivalent) so the service can drive UI state and navigation without depending on a specific screen.

| Callback | When / meaning |
|----------|----------------|
| `radioMissing()` | USB device not found or connection lost; show “connect radio” / snackbar. |
| `radioConnected()` | Handshake finished; radio ready; update PTT button, frequency display, etc. |
| `hideSnackBar()` | Clear “no radio” or similar message. |
| `radioModuleHandshake()` | Handshake in progress (e.g. show “Connecting…”). |
| `radioModuleNotFound()` | COMMAND_VERSION reported radio module not found. |
| `audioTrackCreated()` | Playback path is ready (if UI needs to know). |
| `packetReceived(APRSPacket)` | APRS packet decoded from RX audio; add to chat/list. |
| `scannedToMemory(memoryId)` | Scan moved to this channel; update UI to highlight it. |
| `outdatedFirmware(ver)` | Firmware version too old. |
| `firmwareVersionReceived(ver)` | Informational. |
| `missingFirmware()` | Could not get valid version (e.g. parse error). |
| `txStarted()` | PTT down acknowledged; show TX state, maybe show offset freq. |
| `txEnded()` | PTT up; restore RX display. |
| `chatError(text)` | APRS/chat error message. |
| `sMeterUpdate(value)` | New S-meter value (e.g. 1–9). |
| `aprsBeaconing(beaconing, accuracy)` | Beacon on/off and accuracy (exact/approx). |
| `sentAprsBeacon(lat, lon)` | Position beacon was sent. |
| `unknownLocation()` | Cannot get location for beacon. |
| `forceTunedToFreq(newFreqStr)` | Service changed band/freq (e.g. after band limits change); sync UI. |
| `forcedPttStart()` | Physical PTT pressed; same as user pressing PTT in UI. |
| `forcedPttEnd()` | Physical PTT released. |
| `setRadioType(VHF|UHF)` | From COMMAND_VERSION; update band limits and UI. |
| `showNotification(channelId, typeId, title, message, tapIntent)` | Optional; e.g. APRS message notification. |

### 5.4 TX Audio Path (UI → Service → ESP32)

1. User presses PTT (or physical PTT triggers `forcedPttStart()`).
2. UI calls `startPtt()` and starts **recording** from the microphone at 48 kHz mono (e.g. float or 16-bit).
3. In a loop (e.g. every 40 ms or 1920 samples), the UI reads a buffer of **1920 samples**, then calls `sendAudioToESP32(buffer, false)`. The service applies mic gain, encodes with Opus, and sends COMMAND_HOST_TX_AUDIO (respecting flow control).
4. On PTT release, UI calls `endPtt()` and stops recording.

For **APRS/data**, the same path can be used with `dataMode == true` (no mic gain); the service still encodes and sends Opus (AFSK is generated elsewhere and fed as PCM).

### 5.5 RX Audio and S-Meter

- **COMMAND_RX_AUDIO:** Service receives Opus bytes, decodes to 48 kHz mono float/short, writes to the playback device (e.g. AudioTrack). Optionally feed the same PCM to an AFSK 1200 demodulator for APRS; on decoded packet, call `packetReceived(aprsPacket)`.
- **COMMAND_SMETER_REPORT:** Service parses Rssi, maps to S1–S9 if desired, then calls `sMeterUpdate(value)` so the UI can update an S-meter widget. Only in RX or SCAN mode in the reference app.

---

## 6. ESP32 Firmware Specification

### 6.1 Environment and Entrypoints

- **Framework:** Arduino (ESP32 core 2.0.17; 3.x may need changes).
- **Main file:** e.g. `kv4p_ht_esp32_wroom_32.ino`.
- **setup():**
  - Load board config (pins, features) from `board.h` / Preferences or defaults.
  - USB Serial: `Serial.begin(115200)`, buffer size e.g. 2048 RX/TX.
  - Serial2: 9600 8N1 to RF module (DRA818), pins from `hw.pins`.
  - GPIO: PTT (output), PD (output), SQ (input), optional HL, optional physical PTT inputs.
  - Init I2S/ADC for audio (see §7).
  - Mode = MODE_STOPPED; then `sendHello()` once.
- **loop():**
  - Read squelch pin (debounced) → update `squelched`.
  - `protocolLoop()` (parser.processByte for each byte from Serial).
  - `rxAudioLoop()` (if MODE_RX: copy ADC → effects → Opus encode → sendAudio).
  - `txAudioLoop()` (if MODE_TX: flush Opus decoder to I2S; runaway TX timeout).
  - `rssiLoop()` (if RSSI on and MODE_RX: poll DRA818 for RSSI, send COMMAND_SMETER_REPORT).
  - Buttons and LED logic.

### 6.2 Modes

- **MODE_STOPPED:** PTT high, no I2S TX/RX.
- **MODE_RX:** PTT high, I2S RX active (ADC → Opus → host), squelch can mute audio.
- **MODE_TX:** PTT low, I2S TX active (host Opus → decode → I2S to RF module).

Switching: STOPPED ↔ RX via COMMAND_HOST_GROUP (or COMMAND_HOST_STOP); RX ↔ TX via COMMAND_HOST_PTT_DOWN / COMMAND_HOST_PTT_UP.

### 6.3 Command Handling (handleCommands)

- **COMMAND_HOST_CONFIG:** Copy Config; call doConfig(): select VHF/UHF DRA818 instance, set HL pin if present, run DRA818 handshake (with retries), set volume/filters, then `sendVersion(...)`.
- **COMMAND_HOST_FILTERS:** Copy Filters; call `sa818.filters(pre, high, low)`.
- **COMMAND_HOST_GROUP:** Copy Group; call `sa818.group(bw, freq_tx, freq_rx, ctcss_tx, squelch, ctcss_rx)`; if currently STOPPED, setMode(MODE_RX).
- **COMMAND_HOST_STOP:** setMode(MODE_STOPPED).
- **COMMAND_HOST_PTT_DOWN:** setMode(MODE_TX).
- **COMMAND_HOST_PTT_UP:** setMode(MODE_RX).
- **COMMAND_HOST_TX_AUDIO:** If MODE_TX, `processTxAudio(params, param_len)` (write to Opus decoder → I2S).
- **COMMAND_HOST_HL:** Copy HlState; set HL GPIO if feature present.
- **COMMAND_HOST_RSSI:** Copy RSSIState; set rssiOn.

After processing each received frame, send **COMMAND_WINDOW_UPDATE** with size = 7 + param_len (or the actual frame size consumed).

### 6.4 Physical PTT

When physical PTT pin(s) are configured and the user presses the button, firmware sends COMMAND_PHYS_PTT_DOWN; on release, COMMAND_PHYS_PTT_UP. The host treats these like app PTT (startPtt/endPtt).

### 6.5 Debug Commands

Firmware can send COMMAND_DEBUG_INFO/ERROR/WARN/DEBUG/TRACE with a string payload; the host logs them (e.g. to logcat) for diagnostics.

---

## 7. Audio Pipeline

### 7.1 Constants (Must Match Both Sides)

- **Sample rate:** 48000 Hz.
- **Channels:** 1 (mono).
- **Opus frame size:** 1920 samples (= 40 ms at 48 kHz).
- **Opus application:** VoIP (narrowband) for voice; same frame size for APRS/data path.
- **PROTO_MTU:** 2048 bytes (max Opus frame payload is well under this).

### 7.2 Host (Phone) TX Path

- **Capture:** Microphone at 48 kHz, mono, float or 16-bit.
- **Chunk:** 1920 samples per chunk.
- **Gain:** Optional mic gain (e.g. NONE / 1.5 / 2.0) before encoding.
- **Encode:** Opus encoder (48 kHz, 1 channel, frame size 1920, VBR, narrowband).
- **Send:** COMMAND_HOST_TX_AUDIO with the encoded bytes (length varies).

### 7.3 Host (Phone) RX Path

- **Receive:** COMMAND_RX_AUDIO payload (Opus).
- **Decode:** Opus decoder (48 kHz, 1 channel) → 1920 samples (float or short).
- **Play:** Write to low-latency playback device (e.g. AudioTrack in streaming mode).
- **Optional:** Feed same PCM to AFSK 1200 demodulator for APRS.

### 7.4 ESP32 TX Path (Host → Radio)

- **Receive:** COMMAND_HOST_TX_AUDIO.
- **Decode:** Opus decoder → PCM 16-bit 48 kHz.
- **Output:** I2S in PDM or PCM mode to the pin connected to the RF module’s mic input (e.g. GPIO 25, config in globals.h/board).

### 7.5 ESP32 RX Path (Radio → Host)

- **Input:** ADC (e.g. GPIO 34) from RF module’s audio output; 48 kHz (or slightly over-sampled, e.g. 1.02× to avoid underruns).
- **Processing:** DC offset removal, gain, optional mute when squelched.
- **Encode:** Opus encoder (40 ms frames, narrowband).
- **Send:** COMMAND_RX_AUDIO with encoded bytes.

---

## 8. RF Module and Hardware

### 8.1 DRA818 / SA818

- **Library:** DRA818 (Arduino); SA818 is compatible. Use handshake(), group(), filters(), volume(); RSSI is often polled via a custom command (e.g. "RSSI?" over Serial2) and parsed.
- **UART:** 9600 8N1, two pins (RX, TX) to the module.
- **Bandwidth:** 12.5 kHz (bw=0) or 25 kHz (bw=1).
- **CTCSS:** Index 0 = none; indices 1–38 (or per datasheet) map to standard tones (67–250.3 Hz). The host uses a tone table (e.g. ToneHelper) to map UI strings like "82.5" to index.

### 8.2 CTCSS Tone Table (Reference)

Tone list for UI and index mapping (index 0 = None):  
67, 71.9, 74.4, 77, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100, 103.5, 107.2, 110.9, 114.8, 118.8, 123, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3 (Hz).

### 8.3 Default Pins (globals.h / board.h)

| Symbol | Default | Description |
|--------|---------|-------------|
| PIN_RF_RXD | 16 | Serial2 RX (from RF module TX) |
| PIN_RF_TXD | 17 | Serial2 TX (to RF module RX) |
| PIN_AUDIO_OUT | 25 | I2S data to RF module mic |
| PIN_AUDIO_IN | 34 | ADC input from RF module audio out |
| PIN_PTT | 18 | PTT output (LOW = TX) |
| PIN_PD | 19 | Power down / enable |
| PIN_SQ | 32 | Squelch input (HIGH = squelched) |
| PIN_PHYS_PTT1 / 2 | 5, 33 | Optional physical PTT buttons |
| PIN_LED | 2 | Status LED |
| PIN_PIXELS | 13 | NeoPixel (optional) |
| PIN_HL | -1 or 23 | High/low power; -1 = not used |

Board config can override these (e.g. from NVS/Preferences) for different hardware revisions.

### 8.4 Frequency Bands

- **VHF:** e.g. 134–174 MHz (typical 2 m ham); TX limits configurable (e.g. 144–148 MHz).
- **UHF:** e.g. 400–480 MHz (70 cm); TX limits configurable (e.g. 420–450 MHz).

Host enforces min/max per band and sets `txAllowed` so PTT is disabled out-of-band.

---

## 9. Build and Deployment

### 9.1 Android (Reference)

- **Root:** `android-src/KV4PHT/`
- **Modules:** `app`, `usbSerialForAndroid` (library).
- **Gradle:** compileSdk 35, minSdk 26, targetSdk 35.
- **Key dependencies:**  
  usbSerialForAndroid (local), AndroidX (appcompat, material, room, lifecycle), Play Services Location, Room, Lombok, Concentus (Opus), esp32-flash-lib (firmware update), Apache Commons Math3/Lang3, ZXing.
- **Build:** `./gradlew assembleDebug` or `assembleRelease`.

### 9.2 ESP32 Firmware

- **Arduino:** Open `.ino` in Arduino IDE; board “ESP32 Dev Module”; Tools → Events Run On → Core 0. Libraries: EspSoftwareSerial, DRA818 (manual install from GitHub release), AudioTools (and Opus codec).
- **PlatformIO:** Open `firmware/microcontroller/` (or the folder containing the .ino); build and upload. ESP32 core 2.0.x recommended.
- **Firmware version:** Stored in `.ino` (e.g. FIRMWARE_VER = 15). Host minimum version in app (e.g. FirmwareUtils.PACKAGED_FIRMWARE_VER = 15).

### 9.3 Flashing ESP32 from Phone

Optional: app can put ESP32 into download mode (DTR/RTS sequence) and flash via a serial flasher library (e.g. esp32-flash-lib on Android), using packaged binaries (bootloader, partition table, app). FirmwareActivity and FirmwareUtils are the reference.

---

## 10. Porting to Another Mobile Platform

Use this checklist when rebuilding the app on a different OS (e.g. iOS, Flutter, React Native, or another embedded UI).

### 10.1 Protocol and Data

- [ ] Implement the **exact** frame format (§3): delimiter, 1-byte cmd, 2-byte LE param length, 0–2048 byte params.
- [ ] Implement **FrameParser** state machine and **Sender** with flow-control window; handle COMMAND_WINDOW_UPDATE.
- [ ] Implement all **parameter structs** with same layout and byte order (LE).
- [ ] Run **handshake** (HELLO → CONFIG → VERSION) and enforce minimum firmware version.
- [ ] Handle all **ESP32 → host** commands (S-meter, phys PTT, debug, RX audio, version, window update).

### 10.2 USB and Serial

- [ ] Use platform API to enumerate **USB serial** devices and filter by VID/PID (§4.2).
- [ ] Open port at **115200 8N1**; set RTS/DTR if needed.
- [ ] **Read loop:** feed bytes to FrameParser; run on a dedicated thread or async loop.
- [ ] **Write:** queue frames from Sender; respect flow control so ESP32 does not overrun.

### 10.3 Audio

- [ ] **Capture** at 48 kHz mono; chunk size 1920 samples; pass to Opus **encoder**.
- [ ] **Playback** at 48 kHz mono; receive decoded 1920-sample chunks from Opus **decoder**; use low-latency API.
- [ ] Use **Opus** VoIP/narrowband, 40 ms frames (1920 samples); same MTU limit (≤2048 bytes per frame).

### 10.4 Service and UI Contract

- [ ] Implement the **service/backend** that owns USB, parser, Sender, handshake, and Opus; expose the **methods** listed in §5.2.
- [ ] Define a **callback interface** as in §5.3 and call it from the service when events occur.
- [ ] **Start/bind** the service when the main UI appears; pass callsign, squelch, activeMemoryId, activeFrequencyStr.
- [ ] **Apply settings** from persistence (freq limits, power, filters, squelch, bandwidth, mic gain, APRS, etc.) after connect and when returning from settings.

### 10.5 Data and Persistence

- [ ] **Channel memories:** name, frequency, offset, offsetKhz, tx_tone, rx_tone, group, skip_during_scan.
- [ ] **App settings:** key/value store for all settings listed in §4.5; load on startup and apply to service and UI.

### 10.6 Optional Features

- [ ] **APRS:** AFSK 1200 demodulator on RX PCM; parser for APRS packets; position beacon (periodic or on-demand); message notifications.
- [ ] **Scan:** Cycle through channel list with timing/silence; send COMMAND_HOST_GROUP for each; highlight current channel.
- [ ] **Firmware update:** DTR/RTS bootloader sequence + serial flasher + packaged firmware images.
- [ ] **Physical PTT:** Handle COMMAND_PHYS_PTT_DOWN/UP like app PTT.

### 10.7 ESP32 Firmware

- [ ] No change required for a new phone platform; the protocol and audio format are identical. Ensure the board’s USB VID/PID are either in the app’s filter or that the app can identify the correct serial port by other means.

---

*End of specification. For the canonical protocol changelog and examples, see `firmware/microcontroller/kv4p_ht_esp32_wroom_32/readme.md`.*
