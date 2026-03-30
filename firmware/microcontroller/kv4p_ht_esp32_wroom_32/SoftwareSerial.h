/*
 * ESP32 stub for SoftwareSerial.h
 * The ESP32 Arduino core does not provide SoftwareSerial. This sketch uses
 * HardwareSerial (Serial2) for the DRA818; the DRA818 library still #includes
 * SoftwareSerial.h. This stub satisfies the include so the library compiles.
 * No SoftwareSerial instance is used in this project.
 */
#ifndef SoftwareSerial_h
#define SoftwareSerial_h

#include <Stream.h>

class SoftwareSerial : public Stream {
public:
  SoftwareSerial(uint8_t receivePin, uint8_t transmitPin, bool inverse_logic = false) {}
  void begin(long speed) {}
  bool listen() { return false; }
  void end() {}
  bool isListening() { return false; }
  bool overflow() { return false; }
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
  size_t write(uint8_t) override { return 0; }
  void flush() override {}
  using Print::write;
};

#endif
