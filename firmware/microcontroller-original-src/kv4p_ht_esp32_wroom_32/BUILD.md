# Building the firmware (Arduino IDE, ESP32)

## SoftwareSerial.h / DRA818

The DRA818 library expects `SoftwareSerial.h`, which the ESP32 Arduino core does not provide.

- **Preferred:** This sketch includes a stub `SoftwareSerial.h` in this folder and includes it before `DRA818.h`. Ensure **both** are in the same folder as the `.ino`:
  - `kv4p_ht_esp32_wroom_32.ino`
  - `SoftwareSerial.h`
  Then compile as usual.

- **If you still get “SoftwareSerial.h: No such file or directory”:** Install **EspSoftwareSerial** from Arduino Library Manager (Sketch → Include Library → Manage Libraries → search “EspSoftwareSerial” → Install). The build will then find `SoftwareSerial.h` from that library. The sketch uses `Serial2` (HardwareSerial) only; no actual software serial is used.

## Board

- **FQBN:** `esp32:esp32:esp32` (or ESP32 Dev Module)
- **Partition scheme:** `min_spiffs` (or default)
