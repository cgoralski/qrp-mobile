# KV4P-HT Web App Build Specification

**Version:** 1.0  
**Purpose:** Standalone specification to implement the KV4P-HT handheld ham radio app as a **web application** using the **Web Serial API**. This document is self-contained: it reproduces all protocol, data, and behavior from the original project spec and adds web-specific implementation details.  
**Project site:** https://kv4p.com  
**License:** GPL-3.0 (see repository)

---

## Table of Contents

**Part A – Web-specific**

1. [Web App Overview and Web Serial API](#1-web-app-overview-and-web-serial-api)
2. [Web App Architecture and Modules](#2-web-app-architecture-and-modules)
3. [Implementation Guide (Step-by-Step)](#3-implementation-guide-step-by-step)
4. [Web Platform Checklist](#4-web-platform-checklist)

**Part B – Protocol and behavior (reproduced for standalone use)**

5. [Project and System Overview](#5-project-and-system-overview)
6. [Binary Protocol (Host ↔ ESP32)](#6-binary-protocol-host--esp32)
7. [Handshake and Flow Control](#7-handshake-and-flow-control)
8. [UI and Radio Layer Contract](#8-ui-and-radio-layer-contract)
9. [Audio Pipeline](#9-audio-pipeline)
10. [RF Module and Hardware Reference](#10-rf-module-and-hardware-reference)
11. [Data Models and Persistence](#11-data-models-and-persistence)
12. [ESP32 Firmware (Unchanged)](#12-esp32-firmware-unchanged)

---

# Part A – Web-specific

---

## 1. Web App Overview and Web Serial API

### 1.1 Why Web Serial (not WebUSB)

The KV4P-HT board appears as a **USB serial port** (CDC-ACM or via CP210x/CH340). The **Web Serial API** is the correct browser API for this: it lets a web app open a serial port at a given baud rate and read/write bytes. WebUSB is for lower-level USB endpoints and is not needed for this design. The **same binary protocol** (frames, commands, Opus audio) is used; only the **transport** changes from Android USB host to Web Serial.

### 1.2 Browser Support and Constraints

| Aspect | Detail |
|--------|--------|
| **Support** | Chromium-based browsers (Chrome, Edge). Limited or no support in Firefox, Safari. |
| **Context** | Requires a **secure context**: HTTPS or `localhost`. |
| **User gesture** | Port selection (`requestPort`) must be triggered by a **user gesture** (e.g. click on “Connect radio”). |
| **Tab lifecycle** | When the tab is closed or navigated away, the port is closed. No background execution like Android’s foreground service. |
| **Permissions** | The user grants “serial port” access when they pick the device; no separate microphone permission for serial. Microphone (for PTT) and optional geolocation (for APRS) use standard Permissions API / `getUserMedia` / `getCurrentPosition`. |

### 1.3 Web Serial API – Exact Method and Spec

#### 1.3.1 Feature detection

```javascript
if (!('serial' in navigator)) {
  // Show message: "This app requires a browser that supports Web Serial (e.g. Chrome/Edge)."
}
```

#### 1.3.2 Request a port (must be in a user gesture)

Filter by USB VID/PID so the user only sees the KV4P-HT board (or allow “any” for development). VID/PID in **hex**:

| Chip / board | usbVendorId (hex) | usbProductId (hex) |
|--------------|-------------------|---------------------|
| CP210x       | 0x10C4            | 0xEA60              |
| CH340        | 0x1A86            | 0x7523              |
| (reference)  | 4292 → 0x10C4     | 60000 → 0xEA60      |

```javascript
const filters = [
  { usbVendorId: 0x10C4, usbProductId: 0xEA60 },  // CP210x
  { usbVendorId: 0x1A86, usbProductId: 0x7523 },  // CH340
];
const port = await navigator.serial.requestPort({ filters });
// If user cancels, requestPort throws. Catch and show "No device selected."
```

#### 1.3.3 Open port at 115200 8N1

```javascript
await port.open({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 255,        // optional
  flowControl: 'none'
});
```

#### 1.3.4 Read loop (feed into FrameParser)

Use a read loop that pulls from `port.readable`. Example pattern:

```javascript
const reader = port.readable.getReader();
const decoder = new TextDecoderStream();
const readable = port.readable.pipeThrough(new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(new Uint8Array(chunk));
  }
}));
const readStream = readable.getReader();

while (true) {
  const { value, done } = await readStream.read();
  if (done) break;
  // value is Uint8Array of bytes – feed to FrameParser.processBytes(value)
}
```

Alternatively, read in a loop with `reader.read()` and pass each `value` (Uint8Array) to your parser. On port close or error, the loop exits; then call `reader.releaseLock()` and run your “disconnected” / “radio missing” logic.

#### 1.3.5 Write (send frames to ESP32)

Use `port.writable.getWriter()`, write a `Uint8Array` (your frame: delimiter + cmd + len + params), then `writer.releaseLock()` so the next send can get a writer. Optionally queue sends and serialize in one place so flow control and framing stay correct.

```javascript
const writer = port.writable.getWriter();
writer.write(frameBytes);  // Uint8Array
writer.releaseLock();
```

#### 1.3.6 Close and reconnect

- **Close:** `await port.close();` then clear Sender, parser state, and call UI callback e.g. `radioMissing()`.
- **Reconnect:** From a user gesture, call `navigator.serial.requestPort({ filters })` again, then `port.open(...)` and restart read loop and handshake.

#### 1.3.7 RTS/DTR (optional)

Some boards need RTS/DTR for reset or stability. Web Serial exposes:

```javascript
await port.setSignals({ dataTerminalReady: true, requestToSend: true });
// Later: set to false/true as needed (e.g. for ESP32 bootloader).
```

Use this only if you implement firmware flashing or if the hardware requires it.

### 1.4 Summary: Web Serial usage in this app

| Step | Action |
|------|--------|
| 1 | User clicks “Connect radio”. |
| 2 | `navigator.serial.requestPort({ filters })` with KV4P VID/PID. |
| 3 | `port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' })`. |
| 4 | Start background read loop: read chunks → push to FrameParser → handle commands (§6). |
| 5 | Create Sender that writes frames (delimiter + cmd + 2-byte LE length + params) and respects flow-control window. |
| 6 | Run handshake (wait HELLO → send CONFIG → wait VERSION); then apply settings and tune. |
| 7 | On disconnect/error/close: stop read loop, call `radioMissing()`, allow “Connect” again. |

---

## 2. Web App Architecture and Modules

### 2.1 High-level architecture (control flow and internal structure)

The following diagram shows **control flow** from the web app through Web Serial to the ESP32 and RF module, and the internal structure of the web app (UI → radio controller → serial/protocol/audio/persistence).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB APP (browser tab)                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  UI (React / Vue / vanilla)                                            │   │
│  │  • Main (voice): PTT, frequency, S-meter, memories, scan               │   │
│  │  • Settings: squelch, filters, power, bandwidth, APRS, callsign        │   │
│  │  • Memories: list/add/edit channels                                   │   │
│  │  • APRS / chat (optional)                                              │   │
│  └───────────────────────────────┬───────────────────────────────────────┘   │
│                                  │ calls methods / receives callbacks        │
│  ┌───────────────────────────────▼───────────────────────────────────────┐   │
│  │  Radio controller (same contract as §8)                                │   │
│  │  • start(), tuneToFreq(), tuneToMemory(), startPtt(), endPtt(),        │   │
│  │    setFilters(), setHighPower(), setRssi(), sendAudioToESP32(), …      │   │
│  │  • Invokes callbacks: radioConnected(), txStarted(), sMeterUpdate(),   │   │
│  │    radioMissing(), packetReceived(), …                                 │   │
│  └───────────────────────────────┬───────────────────────────────────────┘   │
│                                  │ uses                                      │
│  ┌───────────────────────────────▼───────────────────────────────────────┐   │
│  │  Serial transport  │  Protocol (Parser + Sender)  │  Handshake        │   │
│  │  • Web Serial open/close/read/write                                  │   │
│  │  • FrameParser (state machine)  • Sender (flow-controlled frames)     │   │
│  │  • Struct encode/decode (Group, Version, Filters, …)                  │   │
│  └───────────────────────────────┬───────────────────────────────────────┘   │
│                                  │                                            │
│  ┌───────────────────────────────▼───────────────────────────────────────┐   │
│  │  Audio (Web Audio API + Opus)                                         │   │
│  │  • TX: getUserMedia → 48 kHz mono → gain → Opus encode → Sender        │   │
│  │  • RX: Parser COMMAND_RX_AUDIO → Opus decode → AudioContext play      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Persistence (IndexedDB or localStorage)                              │   │
│  │  • Channel memories  • App settings (key/value)                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ Web Serial (115200 8N1)
                                ▼
┌───────────────────────────────┐
│  ESP32 board (unchanged)       │  →  DRA818/SA818 RF module
└───────────────────────────────┘
```

### 2.2 Module breakdown

| Module | Responsibility | Inputs / outputs |
|--------|----------------|------------------|
| **Serial transport** | Wrap Web Serial: `requestPort`, `open`, read loop (push Uint8Arrays to parser), write (Uint8Array frames). Handle close/error and notify controller. | User gesture → port; port → byte stream to parser; controller → byte frames to port. |
| **Protocol – FrameParser** | State machine: find delimiter, read cmd, 2-byte LE len, param bytes; dispatch (cmd, params, len) to handler. Reset on bad len or stream error. | In: stream of bytes. Out: (command, params, length) to radio controller. |
| **Protocol – Sender** | Build frame (delimiter + cmd + 2-byte LE param length + params); maintain flow-control window; block or queue when window &lt; frame size; on COMMAND_WINDOW_UPDATE, add size to window. | In: (command, optional params), write interface to transport. Out: bytes to serial transport. |
| **Protocol – structs** | Encode/decode: Group, Filters, Config, HlState, RSSIState, Version, WindowUpdate, Rssi (LE, packed). Used by Sender and by parser handler. | Typed params ↔ Uint8Array. |
| **Handshake** | Wait for HELLO (timeout 1 s); send STOP; send CONFIG; wait VERSION (timeout 60 s); parse Version; validate min firmware, radio status; set flow window; notify connected or error. | Called once after port open; uses Sender and parser’s VERSION/HELLO. |
| **Radio controller** | Same API as §8.2 and §8.3: methods (tuneToFreq, startPtt, …) and callbacks (radioConnected, sMeterUpdate, …). Holds mode, squelch, activeMemoryId, activeFreqStr, channel list, etc.; translates to protocol commands and parses responses. | UI calls methods; controller calls callbacks and uses Sender/parser. |
| **Audio – capture** | getUserMedia(audio) → MediaStream; feed into AudioContext (48 kHz); take 1920-sample chunks (e.g. ScriptProcessorNode or AudioWorklet); apply gain; pass to Opus encoder. | Microphone → float32 or int16 array per 40 ms. |
| **Audio – Opus** | Encode: 1920 samples (48 kHz mono) → Opus bytes (≤ 2048). Decode: Opus bytes → 1920 samples. Use same frame size and narrowband/VoIP as §9. | Use library: e.g. `opus-decoder` / `opus-encoder` (npm), or Concentus/opus-wasm. |
| **Audio – playback** | On COMMAND_RX_AUDIO: decode Opus → 1920 samples; queue to playback (e.g. AudioBufferSourceNode or single buffer + script node). 48 kHz mono. | Decoded PCM → speakers. |
| **Persistence** | IndexedDB (or localStorage): tables/keys for channel_memories and app_settings (same fields as §11). Load on startup; save on change; apply settings to controller. | Read/write channel list and key/value settings. |
| **UI** | Screens: main (PTT, freq, S-meter, scan), settings, memories, optional APRS. Bind to controller methods and callbacks; load/save settings and memories via persistence. | User events → controller methods; callbacks → update DOM/state. |

### 2.3 Where to run the read loop

- **Main thread:** Easiest: run the serial read loop in an async function on the main thread. Each chunk from `port.readable` is passed to FrameParser; the parser calls the command handler (e.g. `handleParsedCommand`), which can update state and call UI callbacks. Use `queueMicrotask` or requestAnimationFrame if you need to avoid blocking.
- **Web Worker:** Move the read loop, FrameParser, Sender, and handshake into a worker; worker posts messages (parsed commands, RX audio) to main; main posts messages (send this frame, open port, etc.). This keeps serial and protocol off the main thread. Main thread then only does UI and audio (getUserMedia and AudioContext must stay on main thread).

---

## 3. Implementation Guide (Step-by-Step)

### 3.1 Prerequisites

- HTTPS or localhost.
- Browser with Web Serial (Chrome/Edge).
- KV4P-HT ESP32 board with firmware that speaks the protocol (§6). No firmware change needed.

### 3.2 Step 1: Protocol and structs

1. Define constants: `COMMAND_DELIMITER = [0xDE, 0xAD, 0xBE, 0xEF]`, `PROTO_MTU = 2048`, and all command codes (Host→ESP32 and ESP32→Host) as in §6.2 and §6.3.
2. Implement **FrameParser** (state machine from §6.6): input byte stream → output (command, params, paramLen). If paramLen &gt; PROTO_MTU, reset parser.
3. Implement **struct encode/decode** (LE):
   - Group: 12 bytes (bw, freq_tx, freq_rx, ctcss_tx, squelch, ctcss_rx).
   - Filters: 1 byte (bits 0,1,2).
   - Config, HlState, RSSIState: 1 byte each.
   - Version: 12 bytes (ver, radioModuleStatus, windowSize, rfModuleType, features).
   - WindowUpdate: 4 bytes (size).
   - Rssi: 1 byte.
4. Implement **Sender**:
   - Frame = delimiter (4) + cmd (1) + paramLen (2, LE) + params.
   - Internal `window` (number). On send: if frame size &gt; window, wait (Promise or queue). Decrease window by frame size after sending. Expose `enlargeWindow(size)` for COMMAND_WINDOW_UPDATE.
   - `sendCommand(cmd, params?)` builds frame and writes via transport.

### 3.3 Step 2: Web Serial transport

1. **Connect (on user click):** `requestPort({ filters })` → `port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' })`.
2. **Read loop:** `const reader = port.readable.getReader();` in a `while (true)` loop, `const { value, done } = await reader.read();` if done break; else pass `value` to FrameParser.
3. **Write:** expose `write(bytes: Uint8Array)` that gets `port.writable.getWriter()`, writes, releases lock.
4. **Close:** `port.close()`, stop read loop, release reader. Notify controller “disconnected”.

### 3.4 Step 3: Handshake

1. After port open, start read loop and create Sender with initial window 0 (or any value; it will be set from VERSION).
2. Wait for **COMMAND_HELLO** (parser emits it): set a Promise resolve or flag. Timeout 1 s → fail.
3. Send **COMMAND_HOST_STOP** (no params).
4. Send **COMMAND_HOST_CONFIG** (1 byte isHigh).
5. Wait for **COMMAND_VERSION** (parser emits it): parse Version struct. Timeout 60 s → fail.
6. Validate: if `ver` &lt; 15 (or your min), call `outdatedFirmware(ver)`; if `radioModuleStatus === 'x'`, call `radioModuleNotFound()`; else set Sender’s window to `version.windowSize`, store rfModuleType and features, call `radioConnected()`.

### 3.5 Step 4: Radio controller

1. Implement the **methods** in §8.2 (start, tuneToFreq, tuneToMemory, setActiveMemoryId, startPtt, endPtt, setFilters, setHighPower, setRssi, setMode, setSquelch, setCallsign, setChannelMemories, sendAudioToESP32, setScanning, setBandwidth, setMicGainBoost, setAprsBeaconPosition, reconnectViaUSB).
2. Implement **command handler** for ESP32→Host commands: SMETER_REPORT → sMeterUpdate; PHYS_PTT_DOWN/UP → forcedPttStart/End (or startPtt/endPtt); HELLO → handshake; VERSION → handshake; WINDOW_UPDATE → Sender.enlargeWindow; RX_AUDIO → decode and play (and optional AFSK); DEBUG_* → console.log.
3. Register **callbacks** object (same as §8.3) and call it from the controller when events occur.

### 3.6 Step 5: Audio

1. **Capture:** `navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 48000, channelCount: 1 } })` (best effort; some browsers may use 48 kHz). Create AudioContext with `sampleRate: 48000`. Use ScriptProcessorNode (deprecated but widely supported) or AudioWorklet to get 1920-sample chunks (40 ms at 48 kHz). Convert to float32 if needed; apply mic gain; pass to Opus encoder.
2. **Opus:** Use an Opus encoder/decoder that supports 48 kHz, 1 channel, 20 ms or 40 ms frames (1920 samples = 40 ms). Encode each chunk; pass result to Sender (COMMAND_HOST_TX_AUDIO) with flow control.
3. **Playback:** When COMMAND_RX_AUDIO arrives, decode to 1920 samples (float32 or int16). Play via AudioContext: e.g. create AudioBuffer(1, 1920, 48000), fill with decoded data, create BufferSource, connect to destination, start. Queue multiple buffers if needed to avoid glitches.

### 3.7 Step 6: Persistence

1. **Channel memories:** Store array of `{ memoryId, name, frequency, offset, offsetKhz, txTone, rxTone, group, skipDuringScan }`. Use IndexedDB (e.g. idb or Dexie) or serialize to localStorage. Load on startup; pass to controller via setChannelMemories.
2. **App settings:** Key/value (same keys as §11). Persist in localStorage or IndexedDB. On load, apply to controller (setSquelch, setHighPower, setFilters, etc.) and restore last frequency/memory (tuneToFreq / tuneToMemory).

### 3.8 Step 7: UI

1. Main view: frequency display, PTT button, S-meter, channel list or memory selector, scan button, settings entry.
2. On “Connect radio”: trigger requestPort and handshake; on radioConnected enable PTT and show frequency; on radioMissing show message and “Connect” again.
3. PTT: on mousedown/touchstart call startPtt() and start sending audio chunks; on mouseup/touchend call endPtt() and stop sending.
4. Settings view: form for squelch, filters, power, bandwidth, mic gain, callsign, APRS options; save to persistence and call controller setters.
5. Memories view: list channels; add/edit/delete; save to persistence and setChannelMemories.

### 3.9 Optional: APRS, scan, firmware

- **APRS:** Implement AFSK 1200 demodulator on RX PCM (e.g. in JS or WASM); parse APRS packets; call packetReceived(packet); optional position beacon (geolocation + encode and send as data).
- **Scan:** When setScanning(true), controller steps through channel list on a timer/silence; each step tuneToMemory(next); call scannedToMemory(id).
- **Firmware:** Use Web Serial to set DTR/RTS for bootloader and send firmware binary (same as Android flasher logic); optional.

---

## 4. Web Platform Checklist

- [ ] **Web Serial:** Feature-detect; requestPort in user gesture; open 115200 8N1; read loop → FrameParser; write via Sender; handle close.
- [ ] **Protocol:** Frame format (§6.1); all command codes and structs (§6.2–6.4); FrameParser state machine (§6.6); Sender with flow control (§7).
- [ ] **Handshake:** HELLO → STOP → CONFIG → VERSION; validate version and radio status; set window.
- [ ] **Radio controller:** All methods (§8.2) and callbacks (§8.3); handle all ESP32→Host commands.
- [ ] **Audio:** 48 kHz mono; 1920-sample chunks; Opus encode (TX) / decode (RX); capture (getUserMedia + AudioContext); playback (AudioContext).
- [ ] **Persistence:** Channel memories and app settings (§11); load on startup and apply.
- [ ] **UI:** Connect, PTT, frequency, S-meter, settings, memories; call controller and respond to callbacks.
- [ ] **ESP32:** No change; same firmware and VID/PID.

---

# Part B – Protocol and behavior (standalone reference)

---

## 5. Project and System Overview

KV4P-HT is an open-source handheld ham radio. The system has three parts:

| Component | Role |
|----------|------|
| **Host app (this web app)** | UI, channel/repeater management, APRS (optional), audio capture/playback, Opus encode/decode, and all communication with the board over **Web Serial**. |
| **ESP32 board** | Connects via USB; runs the same binary protocol; drives the RF module (frequency, PTT, squelch, CTCSS); handles Opus ↔ I2S/ADC for TX and RX audio. |
| **DRA818/SA818 RF module** | Actual VHF/UHF transceiver controlled by the ESP32 over UART and GPIO. |

The host does not transmit radio waves; the board drives the RF module.

**Control flow** (host → board → RF module; same logical flow as the Android version):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HOST (web app)                                                               │
│  • Web Serial @ 115200 8N1                                                    │
│  • Protocol: FrameParser + Sender, flow control                               │
│  • Handshake: HELLO → CONFIG → VERSION                                        │
│  • Opus encode (TX) / decode (RX); Web Audio capture and playback             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ Web Serial (115200 baud)
                                │ CP210x / CH34x etc. (same VID/PID as Android)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  IoT board (ESP32-WROOM-32)                                                   │
│  • protocol.h + FrameParser: same binary protocol                              │
│  • handleCommands(): PTT, group, filters, config, TX audio, etc.             │
│  • txAudio: Opus decode → I2S/PDM → RF module mic input                       │
│  • rxAudio: ADC → Opus encode → COMMAND_RX_AUDIO → host                       │
│  • Serial2 (9600): DRA818/SA818 UART control                                  │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │ UART (GPIO) + I2S/ADC (audio)
┌───────────────────────────▼─────────────────────────────────────────────────┐
│  RF module: DRA818V (VHF) or SA818 (VHF/UHF)                                 │
│  • Actual radio TX/RX; CTCSS, squelch, filters, RSSI                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Binary Protocol (Host ↔ ESP32)

- **Symmetric** frames; **little-endian** for multi-byte fields.  
- **Host** = this app; **ESP32** = board.

### 6.1 Frame format

| Field      | Size (bytes) | Description |
|------------|--------------|-------------|
| Delimiter  | 4            | `0xDE 0xAD 0xBE 0xEF` |
| Command    | 1            | Command code |
| Param len  | 2            | Length of Params (0–65535), LE |
| Params     | 0–2048       | Payload (`PROTO_MTU = 2048`) |

Minimum frame size = **7 + param_len**.

### 6.2 Commands: Host → ESP32

| Code (hex) | Name | Params | Description |
|------------|------|--------|-------------|
| 0x01 | COMMAND_HOST_PTT_DOWN | — | Start transmit |
| 0x02 | COMMAND_HOST_PTT_UP | — | End transmit |
| 0x03 | COMMAND_HOST_GROUP | Group (12 B) | Set frequency, bandwidth, CTCSS, squelch |
| 0x04 | COMMAND_HOST_FILTERS | Filters (1 B) | Pre/de-emphasis, highpass, lowpass |
| 0x05 | COMMAND_HOST_STOP | — | Stop |
| 0x06 | COMMAND_HOST_CONFIG | Config (1 B) | Power config; ESP32 replies with VERSION |
| 0x07 | COMMAND_HOST_TX_AUDIO | byte[] | Opus TX audio (flow-controlled) |
| 0x08 | COMMAND_HOST_HL | HlState (1 B) | High/low power |
| 0x09 | COMMAND_HOST_RSSI | RSSIState (1 B) | Enable/disable RSSI reports |

### 6.3 Commands: ESP32 → Host

| Code (hex) | Name | Params | Description |
|------------|------|--------|-------------|
| 0x53 | COMMAND_SMETER_REPORT | Rssi (1 B) | RSSI 0–255 |
| 0x44 | COMMAND_PHYS_PTT_DOWN | — | Physical PTT pressed |
| 0x55 | COMMAND_PHYS_PTT_UP | — | Physical PTT released |
| 0x01–0x05 | COMMAND_DEBUG_* | char[] | Debug strings |
| 0x06 | COMMAND_HELLO | — | Boot; host starts handshake |
| 0x07 | COMMAND_RX_AUDIO | byte[] | Opus RX audio |
| 0x08 | COMMAND_VERSION | Version (12 B) | Firmware version and capabilities |
| 0x09 | COMMAND_WINDOW_UPDATE | WindowUpdate (4 B) | Flow-control window replenishment |

### 6.4 Parameter structures (LE, packed)

**Group** (12 bytes):

| Offset | Type    | Field     | Description |
|--------|---------|-----------|-------------|
| 0      | uint8_t | bw        | 0x00 = 12.5 kHz, 0x01 = 25 kHz |
| 1      | float   | freq_tx   | TX frequency (MHz) |
| 5      | float   | freq_rx   | RX frequency (MHz) |
| 9      | uint8_t | ctcss_tx  | CTCSS index (0 = none) |
| 10     | uint8_t | squelch   | Squelch level |
| 11     | uint8_t | ctcss_rx  | CTCSS index RX |

**Filters** (1 byte): bit 0 = pre, bit 1 = highpass, bit 2 = lowpass.

**Config** (1 byte): isHigh (0 = low, non-zero = high).

**HlState** (1 byte): isHigh.

**RSSIState** (1 byte): on (0 = disable RSSI, non-zero = enable).

**Rssi** (1 byte): raw RSSI 0–255. Map to S1–S9 e.g. `9.73*ln(0.0297*val)-1.88`, clamp 1–9.

**Version** (12 bytes):

| Offset | Type     | Field              | Description |
|--------|----------|--------------------|-------------|
| 0      | uint16_t | ver                | Firmware version |
| 2      | char     | radioModuleStatus  | 'f' / 'x' / 'u' |
| 3      | uint32_t | windowSize         | Flow-control window |
| 7      | uint8_t  | rfModuleType       | 0 = VHF, 1 = UHF |
| 8      | uint8_t  | features           | Bit 0 = has HL, bit 1 = has physical PTT |

(Note: Total 12 bytes. On ESP32, rfModuleType can be 4 bytes (enum size_t or int), so layout is 2+1+4+4+1 = 12. Match the host parser to the firmware.)

**WindowUpdate** (4 bytes): size (uint32_t).

### 6.5 Frame parser (state machine)

1. Search for 4-byte delimiter; reset on mismatch.
2. Read 1 byte → command.
3. Read 2 bytes LE → param_len.
4. Read param_len bytes → params.
5. Dispatch (command, params, param_len). If param_len &gt; PROTO_MTU, discard and reset.
6. Reset and look for next delimiter.

---

## 7. Handshake and Flow Control

### 7.1 Handshake (host)

1. Wait for **COMMAND_HELLO** (timeout e.g. 1 s).
2. Send **COMMAND_HOST_STOP**.
3. Send **COMMAND_HOST_CONFIG** (1 byte isHigh).
4. Wait for **COMMAND_VERSION** (timeout e.g. 60 s).
5. Parse Version; if ver &lt; 15 show “firmware too old”; if radioModuleStatus === 'x' show “radio not found”; else set Sender window to windowSize, store rfModuleType and features, mark connected.

### 7.2 Flow control

- ESP32 sends **windowSize** in COMMAND_VERSION.
- Host tracks a **window**; each sent frame **decrements** it by (7 + param_len).
- When window &lt; next frame size, host **waits** (or queues).
- ESP32 sends **COMMAND_WINDOW_UPDATE(size)** after processing each frame; host **adds** size to window.

---

## 8. UI and Radio Layer Contract

### 8.1 Methods the UI calls on the radio layer

| Method | Purpose |
|--------|--------|
| start() | Open serial (requestPort + open), start read loop, run handshake. |
| tuneToFreq(frequencyStr, squelchLevel, forceTune) | Send COMMAND_HOST_GROUP (simplex, no CTCSS). |
| tuneToMemory(memoryId, squelchLevel, forceTune) | Load channel; send COMMAND_HOST_GROUP with tx/rx freq, offset, CTCSS. |
| tuneToMemory(channelMemory, squelchLevel, forceTune) | Same with channel object. |
| setActiveMemoryId(id) | If id ≥ 0 tuneToMemory(id,…), else tuneToFreq(activeFrequencyStr,…). |
| startPtt() | If RX and txAllowed: set mode TX, send COMMAND_HOST_PTT_DOWN, notify txStarted. |
| endPtt() | If TX: set mode RX, send COMMAND_HOST_PTT_UP, notify txEnded. |
| setFilters(emphasis, highpass, lowpass) | Send COMMAND_HOST_FILTERS. |
| setHighPower(high) | Send COMMAND_HOST_HL. |
| setRssi(on) | Send COMMAND_HOST_RSSI. |
| setMode(mode) | Internal state (STARTUP, RX, TX, SCAN, BAD_FIRMWARE, FLASHING). |
| setSquelch(level) | Store; next tune uses it. |
| setCallsign(callsign) | For APRS. |
| setChannelMemories(list) | For scan and tuneToMemory. |
| sendAudioToESP32(samples, dataMode) | Opus encode (with mic gain unless dataMode) and send COMMAND_HOST_TX_AUDIO. |
| setScanning(scanning [, goToRxMode]) | Enter/exit SCAN; advance through channels. |
| setBandwidth(bw) | e.g. "25kHz" / "12.5kHz". |
| setMicGainBoost(value) | NONE / low / high. |
| setAprsBeaconPosition(enabled) | Start/stop periodic beacon. |
| reconnectViaUSB() | Close and run requestPort + open + handshake again. |

### 8.2 Callbacks the radio layer invokes on the UI

| Callback | Meaning |
|----------|--------|
| radioMissing() | No port or connection lost. |
| radioConnected() | Handshake done; radio ready. |
| hideSnackBar() | Clear “no radio” message. |
| radioModuleHandshake() | Handshake in progress. |
| radioModuleNotFound() | VERSION reported radio not found. |
| audioTrackCreated() | Playback path ready (optional). |
| packetReceived(APRSPacket) | APRS packet decoded. |
| scannedToMemory(memoryId) | Scan moved to channel. |
| outdatedFirmware(ver) | Firmware too old. |
| firmwareVersionReceived(ver) | Informational. |
| missingFirmware() | Invalid or no VERSION. |
| txStarted() | PTT down. |
| txEnded() | PTT up. |
| chatError(text) | APRS/chat error. |
| sMeterUpdate(value) | S-meter value (e.g. 1–9). |
| aprsBeaconing(beaconing, accuracy) | Beacon state. |
| sentAprsBeacon(lat, lon) | Beacon sent. |
| unknownLocation() | No location for beacon. |
| forceTunedToFreq(newFreqStr) | Band/freq changed by service. |
| forcedPttStart() | Physical PTT pressed. |
| forcedPttEnd() | Physical PTT released. |
| setRadioType(VHF|UHF) | From VERSION. |
| showNotification(...) | Optional. |

---

## 9. Audio Pipeline

- **Sample rate:** 48000 Hz.  
- **Channels:** 1 (mono).  
- **Opus frame size:** 1920 samples (40 ms).  
- **Opus:** VoIP, narrowband.  
- **PROTO_MTU:** 2048 bytes.

**Host TX:** Capture 48 kHz mono → 1920-sample chunks → optional gain → Opus encode → COMMAND_HOST_TX_AUDIO.

**Host RX:** COMMAND_RX_AUDIO → Opus decode → 1920 samples → play (e.g. Web Audio API).

---

## 10. RF Module and Hardware Reference

- **DRA818/SA818:** UART 9600 8N1; group(), filters(), volume(); RSSI polled by firmware.
- **Bandwidth:** 12.5 kHz (bw=0) or 25 kHz (bw=1).
- **CTCSS:** Index 0 = none; indices 1–38 map to standard tones (67–250.3 Hz). Tone list: 67, 71.9, 74.4, 77, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100, 103.5, 107.2, 110.9, 114.8, 118.8, 123, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3 (Hz).
- **Default pins (ESP32):** PIN_RF_RXD 16, PIN_RF_TXD 17, PIN_AUDIO_OUT 25, PIN_AUDIO_IN 34, PIN_PTT 18, PIN_PD 19, PIN_SQ 32, PIN_PHYS_PTT1/2 5/33, PIN_LED 2, PIN_HL -1 or 23.
- **Bands:** VHF e.g. 134–174 MHz; UHF e.g. 400–480 MHz. Host enforces TX limits and txAllowed.

---

## 11. Data Models and Persistence

- **Channel memory:** memoryId, name, frequency ("xxx.xxxx"), offset (none/up/down), offsetKhz, txTone, rxTone, group, skipDuringScan.
- **App settings (key/value):** lastGroup, lastMemoryId, lastFreq, min2mTxFreq, max2mTxFreq, min70cmTxFreq, max70cmTxFreq, rfPower, bandwidth, micGainBoost, squelch, emphasis, highpass, lowpass, disableAnimations, aprsPositionAccuracy, aprsBeaconPosition, callsign, stickyPTT.

Store in IndexedDB or localStorage; load on startup and apply to radio controller and UI.

---

## 12. ESP32 Firmware (Unchanged)

No change is required. The same firmware and protocol are used. Ensure the board’s USB serial uses one of the supported VID/PID (e.g. CP210x 0x10C4/0xEA60 or CH340 0x1A86/0x7523) so the Web Serial filter can match it.

---

*End of Web App Build Specification. For the canonical protocol changelog, see `firmware/microcontroller/kv4p_ht_esp32_wroom_32/readme.md`.*
