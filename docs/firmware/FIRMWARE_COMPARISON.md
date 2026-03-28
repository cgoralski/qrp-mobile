# Firmware comparison notes (no-audio fix)

This repo keeps a **pristine reference** in **`.original-poc/`** (developer’s stock firmware + local `SoftwareSerial.h` and `BUILD.md`) and a **working copy** in **`firmware/`** for edits and builds. The following notes document the RX audio fix and other historical differences.

## Fix applied: RX ADC pin not set (no audio input)

**Cause:** In the current tree, `rxAudio.h` did **not** set the ADC input pin for I2S RX. The original explicitly sets:

```c
config.adc_pin = hw.pins.pinAudioIn;
```

Without this, the ADC may use a library default pin instead of your board’s mic input (e.g. GPIO 34), so no audio is captured → no Opus frames → no `COMMAND_RX_AUDIO` sent to the app.

**Change:** In the sketch’s `rxAudio.h` (in `firmware/microcontroller-original-src/kv4p_ht_esp32_wroom_32/` or `.original-poc/...`), `initI2SRx()` sets `config.adc_pin = hw.pins.pinAudioIn;`.

If your AudioTools version uses a different config field (e.g. `pin_adc`), adjust the name to match your library.

---

## Other differences (no code change)

| Area | Original | Current |
|------|----------|---------|
| **BLE** | None (Serial only) | BLE host added; `hostStream` switches Serial/BLE. When USB only, `hostStream = &Serial` in setup. |
| **Protocol send** | `Serial.write(...)` directly | `hostStream->write(...)` (same when USB). |
| **Parser** | `FrameParser(Serial, &handleCommands)`, `parser.loop()` | `FrameParser(&handleCommands)`, `parser.loop(hostStream)`. Same logic. |
| **DRA818 enum** | `SA818_VHF` / `SA818_UHF` | `DRA818_VHF` / `DRA818_UHF` (different library or fork). |
| **DAC bias** | `driver/dac.h`, `dac_output_voltage` | `driver/dac_oneshot.h` (ESP32 Arduino 3.x). |
| **Setup order** | Serial → boardSetup → … | Serial → delay(200) → flush → boardSetup → hostStream = &Serial → bleSetup → … |
| **WDT** | `esp_task_wdt_init(10, true)` | `esp_task_wdt_config_t` with 10000 ms. |

RX audio path (initI2SRx → rxCopier.copy() → sendAudio) is the same except for the ADC pin and DAC API.

---

## What to do

1. Rebuild and reflash the **firmware** (the ADC pin change is in `rxAudio.h`).
2. Keep using the **current app** (handshake and GROUP timing are already aligned with the POC).

If you still get no audio after flashing, check:

- AudioTools: config might use `pin_adc` or another name instead of `adc_pin`; set the correct member to `hw.pins.pinAudioIn`.
- DRA818: if `sa818.group()` never returns, the radio module may not be responding (power, band, wiring); that would block entry into MODE_RX and thus no RX audio.
