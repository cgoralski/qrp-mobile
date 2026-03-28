# KV4P-HT Communication Protocol

## Required libraries (Arduino IDE)

Install these **before** compiling (Sketch → Include Library → **Manage Libraries**):

| Library       | Author           | Notes |
|---------------|------------------|--------|
| **AudioTools**| Phil Schatzmann  | Search for `AudioTools`. Required by `rxAudio.h` and `txAudio.h`. |
| **arduino-libopus** | Phil Schatzmann | Opus codec. If not in Library Manager, use **Add .ZIP Library** with [arduino-libopus v1.1.0](https://github.com/pschatzmann/arduino-libopus/archive/refs/tags/a1.1.0.zip). |

If **AudioTools** does not appear in Library Manager or resolve fails:

1. **Install from ZIP:** Download [arduino-audio-tools (ZIP)](https://github.com/pschatzmann/arduino-audio-tools/archive/refs/heads/master.zip), then **Sketch → Include Library → Add .ZIP Library…** and select the downloaded file.
2. **Check sketchbook location:** File → Preferences → “Sketchbook location”. Libraries must live in `<Sketchbook>/libraries/`. After adding a ZIP, you should see `<Sketchbook>/libraries/arduino-audio-tools-master/` (or similar). If you installed elsewhere, move the library into `libraries/` or add the library via “Add .ZIP Library” again.
3. **Restart Arduino IDE** and set the board to **ESP32 Dev Module** (or your ESP32 WROOM board), then compile again.

### Sketch size and partition (Arduino IDE)

The firmware is large (Opus + BLE) and **exceeds the default 1.3 MB app partition**. You must do both of the following:

1. **Release build (default):** The sketch defines `RELEASE 1` so debug logging is compiled out. For a debug build, comment out `#define RELEASE 1` in the `.ino` file.
2. **Use a larger app partition:** In Arduino IDE go to **Tools → Partition Scheme** and select **"Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)"** (or similarly named “1.9MB” / “Minimal SPIFFS” option). The default “Default 4MB with spiffs” leaves only ~1.3 MB for the app, which is too small; the linker will fail with “Sketch too big” or “text section exceeds available space” until you switch to a 1.9 MB scheme. Your board must have **4 MB flash** (e.g. ESP32-WROOM-32 with 4 MB).

The `partitions.csv` in this folder matches that layout; having it in the sketch folder is optional once the partition scheme is set in the menu.

**If the board boot-loops after flashing:** Do a full flash erase, then upload again. In Arduino IDE: **Tools → Erase Flash → Erase All Flash Before Sketch Upload** (or use **Erase Flash** once), then **Upload**. Stale NVS or leftover data from a different partition scheme can cause an early crash.

**"No core dump partition found!" at boot:** The sketch's `partitions.csv` includes a 64 KB coredump partition at the end of flash so this message does not appear. If the board ever boot-loops with "Core dump flash config is corrupted" after a crash, do a full flash erase (Tools → Erase Flash) then upload again.

**PlatformIO:** Use env `esp32dev` or `esp32dev-release`; the project’s `platformio.ini` already points to this partition table and `esp32dev-release` adds `-DRELEASE=1`.

---

## Overview

The KV4P-HT protocol defines the communication interface between the microcontroller and external systems. It specifies message structures and command types for data exchange.

Host connection is supported over **USB Serial** (115200 baud) or **Bluetooth Low Energy (BLE)**. For Serial Monitor output, set **Tools → Serial Monitor** to **115200 baud** and choose the correct port; if you see no output after flashing, press the board’s reset button once the monitor is open. When a BLE client connects, all protocol traffic uses BLE; when disconnected, traffic uses USB Serial. The same binary protocol is used on both transports.

## Bluetooth (BLE) and Web Bluetooth

The ESP32 advertises as **`KV4P-HT`** using the **Nordic UART Service (NUS)** so that iOS (Safari 15.4+) and Android (Chrome) web apps can connect via the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

| Item | Value |
|------|--------|
| Device name | `KV4P-HT` |
| Service UUID | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (NUS) |
| RX characteristic (host → ESP32) | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (write) |
| TX characteristic (ESP32 → host) | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` (notify) |

**Web app usage:** Request the NUS service by service UUID, then write command frames to the RX characteristic and subscribe to notifications on the TX characteristic. Use the same packet structure (delimiter `0xDE 0xAD 0xBE 0xEF`, command byte, 2-byte parameter length, parameters). The site must be served over **HTTPS** (required for Web Bluetooth). Re-connect after disconnect by calling `navigator.bluetooth.requestDevice()` again.

## Protocol Version

* **Current Version:** 2.2
* **Changelog:**
  * Incoming command set now includes COMMAND_HOST_HL (0x08) and COMMAND_HOST_RSSI (0x09).
  * COMMAND_HOST_CONFIG params are bool isHigh (not radioType).
  * COMMAND_VERSION payload includes windowSize, rfModuleType, and features (not hw_ver_t).
 
* 2.1
* **Changelog:**
  * Initial version with core command set.
  * Parameter length field upgraded from 1 byte to 2 bytes (`uint16_t`).
  * Added `COMMAND_WINDOW_UPDATE` **(ESP32 → Android)**.
  * `COMMAND_VERSION` payload now includes `windowSize`, **`rfModuleType`**, and **`features`**.
  * Audio streams are now OPUS encoded.
  * Window-based flow control implemented for all incoming commands, inspired by HTTP/2.

## Packet Structure

Each message consists of the following fields:

| Field             | Size (bytes) | Description                                      |
| ----------------- | ------------ | ------------------------------------------------ |
| Command Delimiter | 4            | Fixed value (`0xDEADBEEF`)                       |
| Command           | 1            | Identifies the request or response               |
| Parameter Length  | 2            | Length of the following parameters (0-65535, LE) |
| Parameters        | 0-2048       | Command-specific data                            |

## Incoming Commands (Android → ESP32)

| Command Code | Name                    | Description                                                    |
| ------------ | ----------------------- | -------------------------------------------------------------- |
| `0x01`       | `COMMAND_HOST_PTT_DOWN` | Push-to-talk activation                                        |
| `0x02`       | `COMMAND_HOST_PTT_UP`   | Push-to-talk deactivation                                      |
| `0x03`       | `COMMAND_HOST_GROUP`    | Set group (parameters required)                                |
| `0x04`       | `COMMAND_HOST_FILTERS`  | Set filters (parameters required)                              |
| `0x05`       | `COMMAND_HOST_STOP`     | Stop current operation                                         |
| `0x06`       | `COMMAND_HOST_CONFIG`   | Configure device (may return version)                          |
| `0x07`       | `COMMAND_HOST_TX_AUDIO` | Receive Tx OPUS audio data (payload required, flow-controlled) |
| `0x08`       | `COMMAND_HOST_HL`       | Set High/Low state (parameters required)                       |
| `0x09`       | `COMMAND_HOST_RSSI`     | Enable/disable RSSI reports (parameters required)              |

## Outgoing Commands (ESP32 → Android)

| Command Code | Name                    | Description                                 |
| ------------ | ----------------------- | ------------------------------------------- |
| `0x53`       | `COMMAND_SMETER_REPORT` | Reports RSSI level                          |
| `0x44`       | `COMMAND_PHYS_PTT_DOWN` | Physical push-to-talk activation            |
| `0x55`       | `COMMAND_PHYS_PTT_UP`   | Physical push-to-talk deactivation          |
| `0x01`       | `COMMAND_DEBUG_INFO`    | Sends debug info message                    |
| `0x02`       | `COMMAND_DEBUG_ERROR`   | Sends debug error message                   |
| `0x03`       | `COMMAND_DEBUG_WARN`    | Sends debug warning message                 |
| `0x04`       | `COMMAND_DEBUG_DEBUG`   | Sends debug debug-level message             |
| `0x05`       | `COMMAND_DEBUG_TRACE`   | Sends debug trace message                   |
| `0x06`       | `COMMAND_HELLO`         | Hello handshake message                     |
| `0x07`       | `COMMAND_RX_AUDIO`      | Sends Rx OPUS audio data (payload required) |
| `0x08`       | `COMMAND_VERSION`       | Sends firmware version information          |
| `0x09`       | `COMMAND_WINDOW_UPDATE` | Updates available receive window            |

## Command Parameters

### `COMMAND_VERSION` Parameters

```c
struct version {
  uint16_t     ver;               // 2 bytes
  char         radioModuleStatus; // 1 byte
  size_t       windowSize;        // 4 bytes
  uint8_t      rfModuleType;      // 1 byte (enum)
  uint8_t      features;          // 1 byte (bitmask)
} __attribute__((__packed__));
typedef struct version Version;

// features bitmask
#define FEATURE_HAS_HL      (1 << 0)
#define FEATURE_HAS_PHY_PTT (1 << 1)
```

### `COMMAND_SMETER_REPORT` Parameters

```c
struct rssi {
  uint8_t     rssi; // 1 byte
} __attribute__((__packed__));
typedef struct rssi Rssi;
```

### `COMMAND_HOST_GROUP` Parameters

```c
struct group {
  uint8_t bw;       // 1 byte
  float   freq_tx;  // 4 bytes
  float   freq_rx;  // 4 bytes
  uint8_t ctcss_tx; // 1 byte
  uint8_t squelch;  // 1 byte
  uint8_t ctcss_rx; // 1 byte
} __attribute__((__packed__));
typedef struct group Group;
```

### `COMMAND_HOST_FILTERS` Parameters

```c
struct filters {
  uint8_t flags;  // 1 byte - Uses bitmask for pre, high, and low
} __attribute__((__packed__));
typedef struct filters Filters;

#define FILTER_PRE  (1 << 0) // Bit 0
#define FILTER_HIGH (1 << 1) // Bit 1
#define FILTER_LOW  (1 << 2) // Bit 2
```

### `COMMAND_HOST_CONFIG` Parameters

```c
struct config {
  bool isHigh; // 1 byte
} __attribute__((__packed__));
typedef struct config Config;
```

### `COMMAND_HOST_HL` Parameters

```c
struct hl_state {
  bool isHigh; // 1 byte
} __attribute__((__packed__));
typedef struct hl_state HlState;
```

### `COMMAND_HOST_RSSI` Parameters

```c
struct rssi_state {
  bool on; // 1 byte, true = enable periodic RSSI reports
} __attribute__((__packed__));
typedef struct rssi_state RSSIState;
```

### `COMMAND_WINDOW_UPDATE` Parameters **(ESP32 → Android)**

```c
struct window_update {
  size_t windowSize; // 4 bytes
} __attribute__((__packed__));
typedef struct window_update WindowUpdate;
```

## Flow Control

A window-based flow control mechanism, inspired by HTTP/2, is used to regulate the amount of data sent from Android to the ESP32:

1. **Window Size Declaration**:

   * The ESP32 sends a "desired" initial window size in the `COMMAND_VERSION` payload.
   * This typically matches the size of its internal USB receive buffer.

2. **Window Consumption**:

   * Each incoming command from Android reduces the remaining window size by the size of the entire packet.
   * All commands, not just `COMMAND_HOST_TX_AUDIO`, are subject to this flow control.

3. **Blocking on Exhaustion**:

   * If the next packet does not fit in the remaining window, Android must wait until space is available.
   * Effectively, this blocks transmission when `windowSize < packet size`.

4. **Window Replenishment**:

   * Once the ESP32 finishes processing a packet, it sends a `COMMAND_WINDOW_UPDATE` message.
   * This increases the window size, allowing Android to resume transmission.

5. **Optional Implementation**:

   * Implementing flow control is optional.
   * A compliant implementation may ignore windowSize and COMMAND_WINDOW_UPDATE messages entirely.
   * This is primarily useful when dealing with fast data sources like APRS modems that can generate large amounts of audio data rapidly.
   * When audio is sourced from the ADC, it is inherently flow-controlled by the sampling hardware, making software flow control less necessary.

## Command Handling Strategy

* Most commands follow a **fire-and-forget** approach.
* Some commands may trigger a reply (indicated in comments).
* There are no explicit response types; responses are sent as separate commands.
* All ESP32 incoming commands are subject to **window-based flow control**.

## Byte Order and Bit Significance

* All multi-byte fields are encoded in little-endian format.
* Bitmask values follow LSB-first ordering (bit 0 is the least significant).

## Example Packets

### Push-to-talk activation

```
[ 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x00, 0x00 ]
```

* `0xDEADBEEF`: Command Delimiter
* `0x01`: `COMMAND_HOST_PTT_DOWN`
* `0x00 0x00`: Parameter Length (no parameters)

### Example Debug Message

```
[ 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x05, 0x00, 'E', 'r', 'r', 'o', 'r' ]
```

* `0xDEADBEEF`: Command Delimiter
* `0x01`: `COMMAND_DEBUG_INFO`
* `0x05 0x00`: Parameter Length (5 bytes)
* `'Error'`: Debug message content
