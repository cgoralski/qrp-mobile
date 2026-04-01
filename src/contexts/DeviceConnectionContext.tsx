import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import * as ble from "@/lib/ble-device";
import * as serial from "@/lib/serial-device";
import * as ws from "@/lib/websocket-device";
import { getSavedWifiHost, getSavedWifiPort, saveWifiHostFromUrl } from "@/lib/wifi-storage";
import { createRxPlayback, type RxPlaybackHandle } from "@/lib/rx-audio-playback";
import { getPersistedRadioState } from "@/lib/radio-storage";
import { useSerialLog } from "@/contexts/SerialLogContext";
import { logWifiDiag } from "@/lib/wifi-diagnostics";
import {
  bumpSessionStat,
  logSession,
  noteRxPlaybackEpoch,
} from "@/lib/session-log";
import { RadioLinkKeepAlive } from "@/plugins/radio-link-keepalive";

export type ConnectionType = "usb" | "ble" | "wifi" | null;

interface DeviceConnectionContextValue {
  connected: boolean;
  connectionType: ConnectionType;
  deviceName: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  connectViaUsb: () => Promise<void>;
  connectViaWifi: (hostOrUrl: string, port?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  isBluetoothSupported: boolean;
  isSerialSupported: boolean;
  isWifiSupported: boolean;
  sendData: (data: Uint8Array) => Promise<void>;
  setOnData: (callback: ((data: Uint8Array) => void) | null) => void;
  /** RX playback handle created after Connect (USB or Wi‑Fi). Cleared on disconnect. */
  rxPlaybackHandleRef: React.MutableRefObject<RxPlaybackHandle | null>;
  /** Incremented when a new playback handle is assigned so hooks can re-attach after async create. */
  rxPlaybackEpoch: number;
}

const DeviceConnectionContext = createContext<DeviceConnectionContextValue | null>(null);

export function DeviceConnectionProvider({ children }: { children: ReactNode }) {
  const [connectionType, setConnectionType] = useState<ConnectionType>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rxPlaybackEpoch, setRxPlaybackEpoch] = useState(0);
  const onDataRef = useRef<((data: Uint8Array) => void) | null>(null);
  const rxPlaybackHandleRef = useRef<RxPlaybackHandle | null>(null);
  /** After a successful Wi‑Fi connect, allow one auto-reconnect when the app returns to foreground. */
  const wifiAutoReconnectEnabledRef = useRef(false);
  const connectingRef = useRef(connecting);
  const connectionTypeRef = useRef(connectionType);
  const connectViaWifiRef = useRef<(host: string, port?: number) => Promise<void>>(async () => {});
  /** iOS often RSTs local TCP when the “no internet” Wi‑Fi sheet appears; reconnect without waiting for app resume. */
  const wifiDropReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWifiAutoReconnectAtRef = useRef(0);
  const scheduleWifiDropReconnectRef = useRef<(source: string) => void>(() => {});
  const serialLog = useSerialLog();

  const connected = connectionType !== null;

  useEffect(() => {
    noteRxPlaybackEpoch(rxPlaybackEpoch);
  }, [rxPlaybackEpoch]);

  const logRxDestroyIfAny = useCallback((reason: string) => {
    if (rxPlaybackHandleRef.current) {
      bumpSessionStat("rxPlaybackDestroyed");
      logSession("rx_playback_destroy", { reason });
    }
  }, []);

  const clearWifiAutoReconnect = useCallback(() => {
    wifiAutoReconnectEnabledRef.current = false;
  }, []);

  const scheduleWifiDropReconnect = useCallback((source: string) => {
    if (!Capacitor.isNativePlatform()) {
      logSession("wifi_auto_reconnect skipped", { reason: "not_native", source });
      return;
    }
    if (!wifiAutoReconnectEnabledRef.current) {
      logSession("wifi_auto_reconnect skipped", { reason: "flag_off", source });
      return;
    }
    const host = getSavedWifiHost();
    if (!host) {
      logSession("wifi_auto_reconnect skipped", { reason: "no_saved_host", source });
      return;
    }
    if (wifiDropReconnectTimerRef.current) clearTimeout(wifiDropReconnectTimerRef.current);
    bumpSessionStat("wifiAutoReconnectScheduled");
    logSession("wifi_auto_reconnect timer_armed", { source, delayMs: 400, host });
    wifiDropReconnectTimerRef.current = setTimeout(() => {
      wifiDropReconnectTimerRef.current = null;
      if (!wifiAutoReconnectEnabledRef.current) {
        logSession("wifi_auto_reconnect timer_fired_skipped", { reason: "flag_off" });
        return;
      }
      const now = Date.now();
      if (now - lastWifiAutoReconnectAtRef.current < 1200) {
        bumpSessionStat("wifiAutoReconnectSkippedCooldown");
        logWifiDiag("[DeviceConn] WiFi auto-reconnect skipped (cooldown)");
        logSession("wifi_auto_reconnect skipped_cooldown", {
          msSinceLast: now - lastWifiAutoReconnectAtRef.current,
        });
        return;
      }
      if (connectingRef.current) {
        logSession("wifi_auto_reconnect timer_fired_skipped", { reason: "already_connecting" });
        return;
      }
      if (connectionTypeRef.current !== null) {
        logSession("wifi_auto_reconnect timer_fired_skipped", { reason: "already_connected" });
        return;
      }
      bumpSessionStat("wifiAutoReconnectInvoked");
      lastWifiAutoReconnectAtRef.current = now;
      logWifiDiag(`[DeviceConn] WiFi transient drop (${source}) → auto-reconnect ${host}`);
      logSession("wifi_auto_reconnect invoking_connectViaWifi", { source, host });
      setError(null);
      void connectViaWifiRef.current(host, getSavedWifiPort());
    }, 400);
  }, []);

  useEffect(() => {
    scheduleWifiDropReconnectRef.current = scheduleWifiDropReconnect;
  }, [scheduleWifiDropReconnect]);

  useEffect(() => {
    connectingRef.current = connecting;
  }, [connecting]);

  useEffect(() => {
    connectionTypeRef.current = connectionType;
  }, [connectionType]);

  const clearError = useCallback(() => setError(null), []);

  const setOnData = useCallback((cb: ((data: Uint8Array) => void) | null) => {
    onDataRef.current = cb;
  }, []);

  const sendData = useCallback(async (data: Uint8Array) => {
    if (connectionType === "ble" && ble.isConnected()) {
      await ble.write(data);
    } else if (connectionType === "usb" && serial.isSerialConnected()) {
      await serial.writeSerial(data);
    } else if (connectionType === "wifi" && ws.isConnected()) {
      await ws.write(data);
    }
  }, [connectionType]);

  // Native: keep process + Wi‑Fi active when screen is off (WLAN path). Android: FGS + locks; iOS: audio background.
  useEffect(() => {
    if (connectionType !== "wifi") return;
    void RadioLinkKeepAlive.enable().catch((e) => {
      console.warn("[RadioLinkKeepAlive] enable failed:", e);
      logWifiDiag("[RadioLinkKeepAlive] enable failed: " + (e instanceof Error ? e.message : String(e)));
    });
    return () => {
      void RadioLinkKeepAlive.disable().catch(() => {});
    };
  }, [connectionType]);

  // Native: after sleep/unlock, TCP may RST; reconnect once if we had a good Wi‑Fi session.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      if (timeoutId) clearTimeout(timeoutId);
      logSession("app_foreground_reconnect_timer_armed", { delayMs: 750 });
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        bumpSessionStat("foregroundReconnectTimerFired");
        if (!wifiAutoReconnectEnabledRef.current) {
          logSession("app_foreground_reconnect skipped", { reason: "wifi_auto_off" });
          return;
        }
        if (connectingRef.current || connectionTypeRef.current !== null) {
          logSession("app_foreground_reconnect skipped", {
            reason: "already_connecting_or_connected",
            connecting: connectingRef.current,
            hasLink: connectionTypeRef.current !== null,
          });
          return;
        }
        const host = getSavedWifiHost();
        if (!host) {
          logSession("app_foreground_reconnect skipped", { reason: "no_saved_host" });
          return;
        }
        logWifiDiag("[DeviceConn] app foreground: auto-reconnect Wi‑Fi");
        logSession("app_foreground_reconnect invoking_connectViaWifi", { host });
        void connectViaWifiRef.current(host, getSavedWifiPort());
      }, 750);
    }).then((h) => {
      handle = h;
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      void handle?.remove();
    };
  }, []);

  // WebSocket (WiFi) callbacks
  useEffect(() => {
    ws.setCallbacks({
      onConnect: (url) => {
        logSession("wifi_socket_onConnect", { url: url.slice(0, 120) });
        logWifiDiag("[DeviceConn] WiFi onConnect url=" + url);
        saveWifiHostFromUrl(url);
        ble.disconnect().catch(() => {});
        serial.disconnectSerial().catch(() => {});
        setConnectionType("wifi");
        setDeviceName("WiFi");
        setConnecting(false);
        setError(null);
      },
      onDisconnect: () => {
        const wasWifi = connectionTypeRef.current === "wifi";
        bumpSessionStat("wifiDisconnect");
        logSession("wifi_socket_onDisconnect", { wasWifi });
        logWifiDiag("[DeviceConn] WiFi onDisconnect");
        logRxDestroyIfAny("wifi_onDisconnect");
        rxPlaybackHandleRef.current?.destroy();
        rxPlaybackHandleRef.current = null;
        setRxPlaybackEpoch((e) => e + 1);
        setConnectionType((prev) => {
          if (prev === "wifi") setDeviceName(null);
          return prev === "wifi" ? null : prev;
        });
        setConnecting(false);
        if (wasWifi) scheduleWifiDropReconnectRef.current("disconnect");
      },
      onError: (msg) => {
        const wasWifi = connectionTypeRef.current === "wifi";
        bumpSessionStat("wifiTransportError");
        logSession("wifi_socket_onError", {
          wasWifi,
          msg: msg.length > 160 ? `${msg.slice(0, 157)}…` : msg,
        });
        logWifiDiag("[DeviceConn] WiFi onError: " + msg);
        logRxDestroyIfAny("wifi_onError");
        rxPlaybackHandleRef.current?.destroy();
        rxPlaybackHandleRef.current = null;
        setRxPlaybackEpoch((e) => e + 1);
        setConnecting(false);
        setError(msg);
        // Same as onDisconnect: drop Wi‑Fi link so UI is not "connected" with a stale socket.
        setConnectionType((prev) => {
          if (prev === "wifi") setDeviceName(null);
          return prev === "wifi" ? null : prev;
        });
        if (wasWifi) scheduleWifiDropReconnectRef.current("error");
      },
      onData: (data) => onDataRef.current?.(data),
    });
    return () => ws.setCallbacks({});
  }, [logRxDestroyIfAny]);

  // BLE callbacks
  useEffect(() => {
    ble.setCallbacks({
      onConnect: (name) => {
        clearWifiAutoReconnect();
        serial.disconnectSerial().catch(() => {});
        ws.disconnect().catch(() => {});
        setConnectionType("ble");
        setDeviceName(name);
        setConnecting(false);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionType((prev) => {
          if (prev === "ble") setDeviceName(null);
          return prev === "ble" ? null : prev;
        });
        setConnecting(false);
      },
      onError: (msg) => {
        setConnecting(false);
        setError(msg);
      },
      onData: (data) => onDataRef.current?.(data),
    });
    return () => ble.setCallbacks({});
  }, [clearWifiAutoReconnect]);

  // Serial callbacks. No auto-reconnect: user must tap "Connect to device" each time (including after refresh).
  useEffect(() => {
    serial.setSerialCallbacks({
      onConnect: () => {
        clearWifiAutoReconnect();
        ble.disconnect().catch(() => {});
        ws.disconnect().catch(() => {});
        setConnectionType("usb");
        setDeviceName("USB");
        setConnecting(false);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionType((prev) => (prev === "usb" ? null : prev));
      },
      onError: (msg) => {
        setConnecting(false);
        setError(msg);
      },
      onData: (data) => onDataRef.current?.(data),
      onSerialRxChunk: serialLog?.appendRx ?? undefined,
      onSerialTxChunk: serialLog?.appendTx ?? undefined,
    });
    return () => serial.setSerialCallbacks({});
  }, [clearWifiAutoReconnect, serialLog?.appendRx, serialLog?.appendTx]);

  const connect = useCallback(async () => {
    clearWifiAutoReconnect();
    setError(null);
    setConnecting(true);
    try {
      await ble.connect();
    } catch {
      setConnecting(false);
    }
  }, [clearWifiAutoReconnect]);

  const connectViaUsb = useCallback(async () => {
    clearWifiAutoReconnect();
    setError(null);
    setConnecting(true);
    try {
      logRxDestroyIfAny("usb_connect_prepare");
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      await serial.disconnectSerial();
      await serial.connectSerial();
      const { volume: savedVolume } = getPersistedRadioState();
      const handle = await createRxPlayback(savedVolume);
      rxPlaybackHandleRef.current = handle;
      setRxPlaybackEpoch((e) => e + 1);
      logSession("usb_connect_success", {});
    } catch (e) {
      logRxDestroyIfAny("usb_connect_catch");
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      await serial.disconnectSerial().catch(() => {});
      setConnecting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [clearWifiAutoReconnect, logRxDestroyIfAny]);

  const connectViaWifi = useCallback(async (hostOrUrl: string, port?: number) => {
    bumpSessionStat("wifiConnectStarted");
    logSession("wifi_connectViaWifi start", {
      hostOrUrl: String(hostOrUrl).slice(0, 80),
      port: port ?? "default",
    });
    setError(null);
    setConnecting(true);
    logWifiDiag(`[DeviceConn] connectViaWifi start hostOrUrl=${hostOrUrl} port=${port ?? "default"}`);
    try {
      logRxDestroyIfAny("wifi_connect_prepare");
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      logWifiDiag("[DeviceConn] calling ws.connect…");
      const tWs = typeof performance !== "undefined" ? performance.now() : 0;
      await ws.connect(hostOrUrl, port);
      const wsMs = typeof performance !== "undefined" ? Math.round(performance.now() - tWs) : 0;
      logSession("wifi_ws.connect resolved", { ms: wsMs });
      logWifiDiag("[DeviceConn] ws.connect resolved; starting createRxPlayback…");
      const tRx = typeof performance !== "undefined" ? performance.now() : 0;
      const { volume: savedVolume } = getPersistedRadioState();
      const handle = await createRxPlayback(savedVolume);
      const rxMs = typeof performance !== "undefined" ? Math.round(performance.now() - tRx) : 0;
      rxPlaybackHandleRef.current = handle;
      setRxPlaybackEpoch((e) => e + 1);
      wifiAutoReconnectEnabledRef.current = true;
      bumpSessionStat("wifiConnectSuccess");
      logSession("wifi_connectViaWifi success", { createRxPlaybackMs: rxMs });
      logWifiDiag("[DeviceConn] createRxPlayback OK; WiFi path ready");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      bumpSessionStat("wifiConnectFailed");
      logSession("wifi_connectViaWifi failed", {
        err: err.length > 200 ? `${err.slice(0, 197)}…` : err,
      });
      logWifiDiag("[DeviceConn] connectViaWifi catch: " + err);
      logRxDestroyIfAny("wifi_connect_catch");
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      await ws.disconnect().catch(() => {});
      setConnecting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [logRxDestroyIfAny]);

  useEffect(() => {
    connectViaWifiRef.current = connectViaWifi;
  }, [connectViaWifi]);

  const disconnect = useCallback(async () => {
    clearWifiAutoReconnect();
    if (wifiDropReconnectTimerRef.current) {
      clearTimeout(wifiDropReconnectTimerRef.current);
      wifiDropReconnectTimerRef.current = null;
    }
    if (connectionType === "ble") await ble.disconnect();
    if (connectionType === "usb") await serial.disconnectSerial();
    if (connectionType === "wifi") await ws.disconnect();
    logRxDestroyIfAny("user_disconnect");
    rxPlaybackHandleRef.current?.destroy();
    rxPlaybackHandleRef.current = null;
    setRxPlaybackEpoch((e) => e + 1);
    setConnectionType(null);
    setDeviceName(null);
  }, [clearWifiAutoReconnect, connectionType, logRxDestroyIfAny]);

  const value: DeviceConnectionContextValue = {
    connected,
    connectionType,
    deviceName,
    connecting,
    error,
    connect,
    connectViaUsb,
    connectViaWifi,
    disconnect,
    clearError,
    isBluetoothSupported: false,
    isSerialSupported: serial.isSerialSupported(),
    isWifiSupported: ws.isWifiSupported(),
    sendData,
    setOnData,
    rxPlaybackHandleRef,
    rxPlaybackEpoch,
  };

  return (
    <DeviceConnectionContext.Provider value={value}>
      {children}
    </DeviceConnectionContext.Provider>
  );
}

export function useDeviceConnection(): DeviceConnectionContextValue {
  const ctx = useContext(DeviceConnectionContext);
  if (!ctx) {
    throw new Error("useDeviceConnection must be used within DeviceConnectionProvider");
  }
  return ctx;
}
