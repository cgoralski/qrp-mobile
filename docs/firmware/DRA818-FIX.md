# DRA818 library compilation fix (ESP32 3.x)

The DRA818 library can fail to compile with errors in `DRA818.cpp` about default arguments and `static` linkage. Apply the following edits to your installed DRA818 library.

**File to edit:**  
`DRA818/src/DRA818.cpp`  
(e.g. on macOS: `~/Documents/Arduino/sketches/libraries/DRA818/src/DRA818.cpp`)

## Changes

1. **Remove `static`** from the **definitions** of the three `configure` functions (the header declarations stay as-is).
2. **Remove default `= NULL`** from the last parameter `Stream *log` in the **definitions** only (default remains in the header).

### Edit 1 – SoftwareSerial overload (around line 190)

**Before:**
```cpp
static DRA818* DRA818::configure(SoftwareSerial *stream, uint8_t type, float freq_rx, float freq_tx, uint8_t squelch, uint8_t volume, uint8_t ctcss_rx, uint8_t ctcss_tx, uint8_t bandwidth, bool pre, bool high, bool low, Stream *log = NULL) {
```

**After:**
```cpp
DRA818* DRA818::configure(SoftwareSerial *stream, uint8_t type, float freq_rx, float freq_tx, uint8_t squelch, uint8_t volume, uint8_t ctcss_rx, uint8_t ctcss_tx, uint8_t bandwidth, bool pre, bool high, bool low, Stream *log) {
```

### Edit 2 – HardwareSerial overload (around line 195)

**Before:**
```cpp
static DRA818* DRA818::configure(HardwareSerial *stream, uint8_t type, float freq_rx, float freq_tx, uint8_t squelch, uint8_t volume, uint8_t ctcss_rx, uint8_t ctcss_tx, uint8_t bandwidth, bool pre, bool high, bool low, Stream *log = NULL) {
```

**After:**
```cpp
DRA818* DRA818::configure(HardwareSerial *stream, uint8_t type, float freq_rx, float freq_tx, uint8_t squelch, uint8_t volume, uint8_t ctcss_rx, uint8_t ctcss_tx, uint8_t bandwidth, bool pre, bool high, bool low, Stream *log) {
```

### Edit 3 – DRA818* overload (around line 200)

**Before:**
```cpp
static DRA818* DRA818::configure(DRA818 *dra, float freq_rx, float freq_tx, uint8_t squelch, uint8_t volume, uint8_t ctcss_rx, uint8_t ctcss_tx, uint8_t bandwidth, bool pre, bool high, bool low, Stream *log = NULL) {
```

**After:**
```cpp
DRA818* DRA818::configure(DRA818 *dra, float freq_rx, float freq_tx, uint8_t squelch, uint8_t volume, uint8_t ctcss_rx, uint8_t ctcss_tx, uint8_t bandwidth, bool pre, bool high, bool low, Stream *log) {
```

Do **not** change `DRA818.h`; the declarations there should keep `Stream *log = NULL`.

After saving, run Verify/Compile again in the Arduino IDE.
