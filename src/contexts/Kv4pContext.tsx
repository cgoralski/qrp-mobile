import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { logWifiDiag, logWifiDiagIfSubscribed, previewBytesHex } from "@/lib/wifi-diagnostics";
import { bumpSessionStat, logSession } from "@/lib/session-log";
import {
  Kv4pParser,
  buildPacket,
  buildConfig,
  buildRssiState,
  buildGroup,
  parseVersion,
  parseRssi,
  rawRssiToSUnits,
  parseWindowUpdate,
  type VersionPayload,
  CMD_HOST_PTT_DOWN,
  CMD_HOST_PTT_UP,
  CMD_HOST_GROUP,
  CMD_HOST_CONFIG,
  CMD_HOST_STOP,
  CMD_HOST_RSSI,
  CMD_SMETER_REPORT,
  CMD_VERSION,
  CMD_WINDOW_UPDATE,
  CMD_RX_AUDIO,
  CMD_HELLO,
  CMD_DEBUG_INFO,
  CMD_DEBUG_ERROR,
  CMD_DEBUG_WARN,
  CMD_DEBUG_DEBUG,
  CMD_DEBUG_TRACE,
} from "@/lib/kv4p-protocol";

/** Device → host only: firmware `debug.h` / `_LOGI` etc. (same numeric values as some HOST_* constants but never received from wire as host commands). */
const BOARD_DEBUG_LEVEL: Record<number, string> = {
  [CMD_DEBUG_INFO]: "INFO",
  [CMD_DEBUG_ERROR]: "ERROR",
  [CMD_DEBUG_WARN]: "WARN",
  [CMD_DEBUG_DEBUG]: "DEBUG",
  [CMD_DEBUG_TRACE]: "TRACE",
};

function isBoardDebugPacket(cmd: number): boolean {
  return BOARD_DEBUG_LEVEL[cmd] !== undefined;
}

interface Kv4pContextValue {
  /** Current S-meter (0–9). From device COMMAND_SMETER_REPORT, calibrated. */
  rssi: number;
  /** Firmware version info (after COMMAND_VERSION received). */
  version: VersionPayload | null;
  /** Send PTT down to radio. */
  sendPttDown: () => void;
  /** Send PTT up to radio. */
  sendPttUp: () => void;
  /** Set frequency group (tx/rx in MHz). Simplex: use same freq for both. */
  sendGroup: (params: {
    freqTx: number;
    freqRx: number;
    bw?: number;
    ctcssTx?: number;
    squelch?: number;
    ctcssRx?: number;
  }) => void;
  /** Request version from device (sends COMMAND_HOST_CONFIG). */
  requestVersion: () => void;
  /** True for the first ~5s after USB connect while waiting before handshake (show "Connecting to radio..."). */
  handshakePending: boolean;
  /** Send STOP to put board in MODE_STOPPED; use before GROUP for reliable RX start. */
  sendStop: () => void;
  /** Enable or disable RSSI reports from device. */
  setRssiEnabled: (on: boolean) => void;
  /** Send raw KV4P packet (for advanced use, e.g. TX audio). */
  sendCommand: (cmd: number, params?: Uint8Array) => void;
  /** Register/unregister RX audio callback. Set to a function to receive Opus chunks, or null to clear. */
  setOnRxAudio: (callback: ((data: Uint8Array) => void) | null) => void;
  /** Last `Date.now()` when a device → host RX audio frame arrived; 0 if none this link. */
  rxAudioLastChunkAtRef: MutableRefObject<number>;
}

const Kv4pContext = createContext<Kv4pContextValue | null>(null);

export function Kv4pProvider({ children }: { children: ReactNode }) {
  const { connected, connectionType, sendData, setOnData } = useDeviceConnection();
  const [rssi, setRssi] = useState(0);
  const [version, setVersion] = useState<VersionPayload | null>(null);
  const [handshakePending, setHandshakePending] = useState(false);
  const windowSizeRef = useRef(0);
  const parserRef = useRef<Kv4pParser | null>(null);
  const onRxAudioRef = useRef<((data: Uint8Array) => void) | null>(null);
  const rxAudioLastChunkAtRef = useRef(0);
  const rxAudioQueueRef = useRef<Uint8Array[]>([]);
  const RX_AUDIO_QUEUE_MAX = 30;
  const rxAudioChunkCountRef = useRef(0);
  const parsedPacketCountRef = useRef(0);
  const handshakeSentRef = useRef(false);
  const triggerHandshakeRef = useRef<() => void>(() => {});
  const versionReceivedRef = useRef(false);
  const handshakeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handshakeRetryCountRef = useRef(0);
  const HANDSHAKE_RETRY_MAX = 2;
  const boardDebugWifiLogCountRef = useRef(0);
  const wasConnectedRef = useRef(false);

  const sendCommand = useCallback(
    (cmd: number, params?: Uint8Array) => {
      const packet = buildPacket(cmd, params);
      sendData(packet);
    },
    [sendData]
  );

  const sendPttDown = useCallback(() => sendCommand(CMD_HOST_PTT_DOWN), [sendCommand]);
  const sendPttUp = useCallback(() => sendCommand(CMD_HOST_PTT_UP), [sendCommand]);

  const sendGroup = useCallback(
    (params: {
      freqTx: number;
      freqRx: number;
      bw?: number;
      ctcssTx?: number;
      squelch?: number;
      ctcssRx?: number;
    }) => {
      const body = buildGroup({
        bw: params.bw ?? 0,
        freqTx: params.freqTx,
        freqRx: params.freqRx,
        ctcssTx: params.ctcssTx ?? 0,
        squelch: params.squelch ?? 0, // 0 = wide open (default for all devices)
        ctcssRx: params.ctcssRx ?? 0,
      });
      sendCommand(CMD_HOST_GROUP, body);
    },
    [sendCommand]
  );

  const requestVersion = useCallback(() => {
    sendCommand(CMD_HOST_CONFIG, buildConfig(false));
  }, [sendCommand]);

  const runHandshake = useCallback(
    async (isRetry?: boolean) => {
      if (!isRetry && handshakeSentRef.current) return;
      if (!isRetry) handshakeSentRef.current = true;
      try {
        // On retry (quick replug, no HELLO): send STOP twice to try to clear board state before CONFIG.
        if (isRetry) {
          const s1 = buildPacket(CMD_HOST_STOP);
          logWifiDiag(`[KV4P] handshake TX STOP ${previewBytesHex(s1)}`);
          await sendData(s1);
          await new Promise((r) => setTimeout(r, 100));
          const s2 = buildPacket(CMD_HOST_STOP);
          logWifiDiag(`[KV4P] handshake TX STOP(2) ${previewBytesHex(s2)}`);
          await sendData(s2);
          await new Promise((r) => setTimeout(r, 80));
        } else {
          const s0 = buildPacket(CMD_HOST_STOP);
          logWifiDiag(`[KV4P] handshake TX STOP ${previewBytesHex(s0)}`);
          await sendData(s0);
          await new Promise((r) => setTimeout(r, 80));
        }
        const cfg = buildPacket(CMD_HOST_CONFIG, buildConfig(true));
        logWifiDiag(`[KV4P] handshake TX CONFIG ${previewBytesHex(cfg)}`);
        await sendData(cfg);
        const rssi = buildPacket(CMD_HOST_RSSI, buildRssiState(true));
        logWifiDiag(`[KV4P] handshake TX RSSI ${previewBytesHex(rssi)}`);
        await sendData(rssi);
        console.log("[KV4P] Handshake sent (STOP, CONFIG, RSSI)" + (isRetry ? ` (retry ${handshakeRetryCountRef.current}/${HANDSHAKE_RETRY_MAX})` : ""));
        logWifiDiag("[KV4P] handshake sent (STOP, CONFIG, RSSI)" + (isRetry ? ` retry=${handshakeRetryCountRef.current}` : ""));
      } catch (e) {
        console.warn("[KV4P] Handshake send failed:", e);
        logWifiDiag("[KV4P] handshake send failed: " + (e instanceof Error ? e.message : String(e)));
      }
      const scheduleRetry = () => {
        if (handshakeRetryTimerRef.current) clearTimeout(handshakeRetryTimerRef.current);
        handshakeRetryTimerRef.current = setTimeout(() => {
          handshakeRetryTimerRef.current = null;
          if (versionReceivedRef.current) return;
          if (handshakeRetryCountRef.current >= HANDSHAKE_RETRY_MAX) return;
          handshakeRetryCountRef.current += 1;
          console.log("[KV4P] No version after 2s, retrying handshake");
          runHandshake(true);
        }, 2000);
      };
      if (isRetry) {
        scheduleRetry();
        return;
      }
      handshakeRetryCountRef.current = 0;
      scheduleRetry();
    },
    [sendData]
  );

  const sendStop = useCallback(() => {
    sendCommand(CMD_HOST_STOP);
  }, [sendCommand]);

  const setRssiEnabled = useCallback(
    (on: boolean) => {
      sendCommand(CMD_HOST_RSSI, buildRssiState(on));
    },
    [sendCommand]
  );

  const setOnRxAudio = useCallback((callback: ((data: Uint8Array) => void) | null) => {
    if (callback) {
      const queue = rxAudioQueueRef.current;
      for (let i = 0; i < queue.length; i++) callback(queue[i]);
      rxAudioQueueRef.current = [];
    } else {
      rxAudioQueueRef.current = [];
    }
    onRxAudioRef.current = callback;
  }, []);

  useEffect(() => {
    const parser = new Kv4pParser((cmd, params) => {
      try {
        const n = ++parsedPacketCountRef.current;
        if (import.meta.env.DEV && (n <= 25 || n % 100 === 0)) {
          console.log("[KV4P] packet #" + n + " cmd=0x" + cmd.toString(16).padStart(2, "0") + " plen=" + params.length);
        }
        if (!isBoardDebugPacket(cmd) && (n <= 45 || n % 200 === 0)) {
          const hex =
            params.length > 64
              ? `${params.length}b (hex omitted)`
              : previewBytesHex(params, 24);
          logWifiDiagIfSubscribed(`[KV4P] pkt #${n} cmd=0x${cmd.toString(16).padStart(2, "0")} ${hex}`);
        }
        switch (cmd) {
          case CMD_DEBUG_INFO:
          case CMD_DEBUG_ERROR:
          case CMD_DEBUG_WARN:
          case CMD_DEBUG_DEBUG:
          case CMD_DEBUG_TRACE: {
            boardDebugWifiLogCountRef.current += 1;
            const d = boardDebugWifiLogCountRef.current;
            if (d <= 35 || d % 45 === 0) {
              const level = BOARD_DEBUG_LEVEL[cmd] ?? "?";
              const text = new TextDecoder("utf-8", { fatal: false })
                .decode(params)
                .replace(/\r?\n/g, "↵")
                .trim();
              const short = text.length > 200 ? `${text.slice(0, 197)}…` : text;
              logWifiDiag(`[KV4P] board ${level} (${params.length}b): ${short}`);
            }
            break;
          }
          case CMD_SMETER_REPORT:
            if (params.length >= 1) setRssi(rawRssiToSUnits(parseRssi(params)));
            break;
          case CMD_VERSION:
            if (params.length >= 9) {
              versionReceivedRef.current = true;
              setHandshakePending(false);
              if (handshakeRetryTimerRef.current) {
                clearTimeout(handshakeRetryTimerRef.current);
                handshakeRetryTimerRef.current = null;
              }
              const v = parseVersion(params);
              setVersion(v);
              windowSizeRef.current = v.windowSize;
              console.log("[KV4P] version received, windowSize=" + v.windowSize);
              logWifiDiag(
                `[KV4P] VERSION ver=${v.ver} radioStatus=${v.radioModuleStatus} rfModule=${v.rfModuleType} window=${v.windowSize} features=${v.features}`
              );
              bumpSessionStat("kv4pVersionReceived");
              logSession("kv4p_VERSION", {
                ver: v.ver,
                rf: v.rfModuleType,
                window: v.windowSize,
              });
            }
            break;
          case CMD_WINDOW_UPDATE:
            if (params.length >= 4) {
              windowSizeRef.current += parseWindowUpdate(params);
            }
            break;
          case CMD_RX_AUDIO: {
            const n = ++rxAudioChunkCountRef.current;
            rxAudioLastChunkAtRef.current = Date.now();
            if (import.meta.env.DEV && (n <= 3 || n % 50 === 0)) {
              console.log("[KV4P] RX audio chunk #" + n + ",", params.length, "bytes");
            }
            const cb = onRxAudioRef.current;
            if (cb) {
              cb(params);
            } else {
              const queue = rxAudioQueueRef.current;
              queue.push(params.slice(0));
              if (queue.length > RX_AUDIO_QUEUE_MAX) queue.shift();
            }
            break;
          }
          case CMD_HELLO:
            console.log("[KV4P] HELLO received, sending handshake");
            logWifiDiag("[KV4P] HELLO from board → trigger handshake");
            triggerHandshakeRef.current();
            break;
          default:
            break;
        }
      } catch (err) {
        console.warn("[KV4P] Command handler error:", cmd, err);
      }
    });
    parserRef.current = parser;
    setOnData((data) => parser.feed(data));
    return () => {
      setOnData(null);
      parser.reset();
      parserRef.current = null;
    };
    // sendData omitted from deps: unused here; extra deps recreated the parser and dropped the RX handler briefly.
  }, [setOnData]);

  useEffect(() => {
    if (!connected) {
      if (wasConnectedRef.current) {
        bumpSessionStat("kv4pDisconnectedReset");
        logSession("kv4p_disconnected_reset_parser");
      }
      wasConnectedRef.current = false;
      logWifiDiag("[KV4P] disconnected → reset parser/handshake state");
      setRssi(0);
      setVersion(null);
      setHandshakePending(false);
      windowSizeRef.current = 0;
      rxAudioChunkCountRef.current = 0;
      rxAudioLastChunkAtRef.current = 0;
      parsedPacketCountRef.current = 0;
      boardDebugWifiLogCountRef.current = 0;
      handshakeSentRef.current = false;
      versionReceivedRef.current = false;
      handshakeRetryCountRef.current = 0;
      if (handshakeRetryTimerRef.current) {
        clearTimeout(handshakeRetryTimerRef.current);
        handshakeRetryTimerRef.current = null;
      }
      parserRef.current?.reset();
      return;
    }
    wasConnectedRef.current = true;
    // USB: wait 5s so the board can finish booting. WiFi: send handshake quickly to avoid idle timeout and get data flowing.
    const handshakeDelayMs = connectionType === "wifi" ? 400 : 5000;
    handshakeSentRef.current = false;
    versionReceivedRef.current = false;
    setHandshakePending(true);
    logWifiDiag(`[KV4P] connected type=${connectionType} handshake scheduled in ${handshakeDelayMs}ms`);
    logSession("kv4p_handshake_scheduled", { type: connectionType ?? "?", delayMs: handshakeDelayMs });
    triggerHandshakeRef.current = () => {}; // Don't send on HELLO; only send after delay
    const t = window.setTimeout(() => {
      if (handshakeSentRef.current) return;
      setHandshakePending(false);
      console.log("[KV4P] handshake delay elapsed (" + handshakeDelayMs + "ms), sending handshake");
      logWifiDiag("[KV4P] handshake delay elapsed → runHandshake()");
      runHandshake();
    }, handshakeDelayMs);
    return () => {
      window.clearTimeout(t);
      setHandshakePending(false);
      if (handshakeRetryTimerRef.current) {
        clearTimeout(handshakeRetryTimerRef.current);
        handshakeRetryTimerRef.current = null;
      }
      triggerHandshakeRef.current = () => {};
    };
  }, [connected, connectionType, runHandshake]);

  const value: Kv4pContextValue = {
    rssi,
    version,
    sendPttDown,
    sendPttUp,
    sendGroup,
    requestVersion,
    handshakePending,
    sendStop,
    setRssiEnabled,
    sendCommand,
    setOnRxAudio,
    rxAudioLastChunkAtRef,
  };

  return <Kv4pContext.Provider value={value}>{children}</Kv4pContext.Provider>;
}

export function useKv4p(): Kv4pContextValue {
  const ctx = useContext(Kv4pContext);
  if (!ctx) {
    throw new Error("useKv4p must be used within Kv4pProvider");
  }
  return ctx;
}
