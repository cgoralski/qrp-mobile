/*
 * WiFi + plain WebSocket server for KV4P-HT.
 * Same KV4P binary protocol over ws://<board-ip>:8765.
 * Credentials: set WIFI_SSID and WIFI_PASS below or via build_flags.
 */
#pragma once

#include <Arduino.h>

// Default port for the web app (must match src/lib/websocket-device.ts DEFAULT_WS_PORT).
#define WIFI_WS_PORT 8765

// AP mode: board creates a WiFi hotspot. Phone connects, then app uses ws://192.168.4.1:8765
#ifndef WIFI_SSID
#define WIFI_SSID "KV4P-Radio"
#define WIFI_PASS "kv4p-radio"
#endif

/**
 * Stream that reads from WebSocket receive buffer and writes to the connected WebSocket client.
 * When no client is connected, available() is 0 and write() is a no-op.
 */
class WsStream : public Stream {
 public:
  WsStream();
  int available() override;
  int read() override;
  int peek() override;
  size_t write(uint8_t b) override;
  size_t write(const uint8_t* buf, size_t size) override;

  /** Push bytes received from WebSocket (called from server callback). */
  void push(const uint8_t* data, size_t len);
  /** Call when client disconnects (clear any partial state). */
  void onDisconnect();

  /** True when a WebSocket client is connected. */
  bool hasClient() const { return clientNum_ >= 0; }

  /** Set the client index for sending (called from handler on connect). */
  void setClientNum(int num);
  /** Clear the client (called from handler on disconnect). */
  void clearClient();

 private:
  static const size_t RBUF_SIZE = 4096;
  uint8_t rbuf_[RBUF_SIZE];
  size_t rhead_;
  size_t rtail_;
  int clientNum_;  // Links2004 client index, or -1 if none

  size_t rbufCount() const;
};

/** Call from setup() after boardSetup(). Starts AP and WebSocket server. */
void wifi_ws_setup();

/** Call every loop(). Returns true if a WebSocket client is connected. */
bool wifi_ws_hasClient();

/** Stream for protocol I/O when a client is connected. Always valid; available() is 0 when no client. */
WsStream& wifi_ws_getStream();

/** Process WebSocket server and feed received data into the stream. Call from loop(). */
void wifi_ws_loop();
