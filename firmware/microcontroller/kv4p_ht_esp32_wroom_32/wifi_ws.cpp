/*
 * WiFi + plain WebSocket server for KV4P-HT.
 * Accepts both binary frames and text frames (base64) so the Capacitor app can use
 * a text-only WebSocket plugin. Sends as text (base64) so Android receives.
 */
#include "wifi_ws.h"
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <mbedtls/base64.h>
#include <string.h>

static WebSocketsServer* g_server = nullptr;
static WsStream g_wsStream;

// Temp buffer for base64 decode (incoming text) and encode (outgoing). 4K binary -> ~5462 base64.
static uint8_t s_b64Buf[8192];
static const size_t s_b64BufSize = sizeof(s_b64Buf);

static void onWsEvent(uint8_t client_num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      g_wsStream.setClientNum((int)client_num);
      break;
    case WStype_DISCONNECTED:
      g_wsStream.clearClient();
      break;
    case WStype_BIN:
      if (payload && length > 0)
        g_wsStream.push(payload, length);
      break;
    case WStype_TEXT: {
      // App (Capacitor plugin) sends base64-encoded binary as text. Decode and push.
      if (!payload || length == 0) break;
      size_t olen = 0;
      int ret = mbedtls_base64_decode(s_b64Buf, s_b64BufSize, &olen, payload, length);
      if (ret == 0 && olen > 0)
        g_wsStream.push(s_b64Buf, olen);
      break;
    }
    default:
      break;
  }
}

// -----------------------------------------------------------------------------
// WsStream
// -----------------------------------------------------------------------------

WsStream::WsStream() : rhead_(0), rtail_(0), clientNum_(-1), txAccumLen_(0), txAccumFirstMs_(0) {}

size_t WsStream::rbufCount() const {
  if (rhead_ >= rtail_) return rhead_ - rtail_;
  return RBUF_SIZE - rtail_ + rhead_;
}

int WsStream::available() {
  return (int)rbufCount();
}

int WsStream::read() {
  if (rbufCount() == 0) return -1;
  int out = rbuf_[rtail_];
  rtail_ = (rtail_ + 1) % RBUF_SIZE;
  return out;
}

int WsStream::peek() {
  return rbufCount() == 0 ? -1 : (int)rbuf_[rtail_];
}

size_t WsStream::write(uint8_t b) {
  return write(&b, 1);
}

bool WsStream::sendTxtB64_(const uint8_t* data, size_t len) {
  if (len == 0 || clientNum_ < 0 || !g_server) return false;
  size_t olen = 0;
  size_t maxEnc = (len + 2) / 3 * 4 + 1;
  if (maxEnc > s_b64BufSize) return false;
  int ret = mbedtls_base64_encode(s_b64Buf, s_b64BufSize, &olen, data, len);
  if (ret != 0 || olen == 0) return false;
  s_b64Buf[olen] = '\0';
  g_server->sendTXT(clientNum_, (const char*)s_b64Buf);
  return true;
}

void WsStream::flushTxAccum_() {
  if (txAccumLen_ == 0) return;
  if (!sendTxtB64_(txAccum_, txAccumLen_)) {
    // Drop batch so write() cannot spin if the socket back-pressures.
    txAccumLen_ = 0;
    return;
  }
  txAccumLen_ = 0;
}

void WsStream::flushPendingOutboundTx() {
  if (txAccumLen_ == 0 || clientNum_ < 0) return;
  uint32_t now = millis();
  if ((uint32_t)(now - txAccumFirstMs_) >= TX_ACCUM_MAX_MS)
    flushTxAccum_();
}

size_t WsStream::write(const uint8_t* buf, size_t size) {
  if (size == 0 || clientNum_ < 0 || !g_server) return 0;
  // Single huge write: avoid fragmenting (not typical for KV4P).
  if (size > TX_ACCUM_SIZE) {
    flushTxAccum_();
    return sendTxtB64_(buf, size) ? size : 0;
  }
  size_t offset = 0;
  while (offset < size) {
    if (txAccumLen_ > 0 && (uint32_t)(millis() - txAccumFirstMs_) >= TX_ACCUM_MAX_MS)
      flushTxAccum_();
    if (txAccumLen_ == 0)
      txAccumFirstMs_ = millis();
    size_t room = TX_ACCUM_SIZE - txAccumLen_;
    if (room == 0) {
      flushTxAccum_();
      continue;
    }
    size_t chunk = size - offset;
    if (chunk > room) chunk = room;
    memcpy(txAccum_ + txAccumLen_, buf + offset, chunk);
    txAccumLen_ += chunk;
    offset += chunk;
    if (txAccumLen_ >= TX_ACCUM_HIGH_WM)
      flushTxAccum_();
  }
  return size;
}

void WsStream::push(const uint8_t* data, size_t len) {
  if (!data) return;
  for (size_t i = 0; i < len; i++) {
    size_t next = (rhead_ + 1) % RBUF_SIZE;
    if (next == rtail_) break;
    rbuf_[rhead_] = data[i];
    rhead_ = next;
  }
}

void WsStream::onDisconnect() {
  rhead_ = rtail_ = 0;
  txAccumLen_ = 0;
}

void WsStream::setClientNum(int num) {
  clientNum_ = num;
}

void WsStream::clearClient() {
  clientNum_ = -1;
  rhead_ = rtail_ = 0;
  txAccumLen_ = 0;
}

// -----------------------------------------------------------------------------
// WiFi + WebSocket server
// -----------------------------------------------------------------------------

void wifi_ws_setup() {
  if (strlen(WIFI_SSID) == 0) return;
  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_SSID, WIFI_PASS);

  g_server = new WebSocketsServer(WIFI_WS_PORT);
  g_server->begin();
  g_server->onEvent(onWsEvent);
}

bool wifi_ws_hasClient() {
  return g_wsStream.hasClient();
}

WsStream& wifi_ws_getStream() {
  return g_wsStream;
}

void wifi_ws_loop() {
  if (g_server)
    g_server->loop();
  g_wsStream.flushPendingOutboundTx();
}
