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
  const serialLog = useSerialLog();

  const connected = connectionType !== null;

  const clearWifiAutoReconnect = useCallback(() => {
    wifiAutoReconnectEnabledRef.current = false;
  }, []);

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
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        if (!wifiAutoReconnectEnabledRef.current) return;
        if (connectingRef.current || connectionTypeRef.current !== null) return;
        const host = getSavedWifiHost();
        if (!host) return;
        logWifiDiag("[DeviceConn] app foreground: auto-reconnect Wi‑Fi");
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
        logWifiDiag("[DeviceConn] WiFi onDisconnect");
        rxPlaybackHandleRef.current?.destroy();
        rxPlaybackHandleRef.current = null;
        setRxPlaybackEpoch((e) => e + 1);
        setConnectionType((prev) => {
          if (prev === "wifi") setDeviceName(null);
          return prev === "wifi" ? null : prev;
        });
        setConnecting(false);
      },
      onError: (msg) => {
        logWifiDiag("[DeviceConn] WiFi onError: " + msg);
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
      },
      onData: (data) => onDataRef.current?.(data),
    });
    return () => ws.setCallbacks({});
  }, []);

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
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      await serial.disconnectSerial();
      await serial.connectSerial();
      const { volume: savedVolume } = getPersistedRadioState();
      const handle = await createRxPlayback(savedVolume);
      rxPlaybackHandleRef.current = handle;
      setRxPlaybackEpoch((e) => e + 1);
    } catch (e) {
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      await serial.disconnectSerial().catch(() => {});
      setConnecting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [clearWifiAutoReconnect]);

  const connectViaWifi = useCallback(async (hostOrUrl: string, port?: number) => {
    setError(null);
    setConnecting(true);
    logWifiDiag(`[DeviceConn] connectViaWifi start hostOrUrl=${hostOrUrl} port=${port ?? "default"}`);
    try {
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      logWifiDiag("[DeviceConn] calling ws.connect…");
      await ws.connect(hostOrUrl, port);
      logWifiDiag("[DeviceConn] ws.connect resolved; starting createRxPlayback…");
      const { volume: savedVolume } = getPersistedRadioState();
      const handle = await createRxPlayback(savedVolume);
      rxPlaybackHandleRef.current = handle;
      setRxPlaybackEpoch((e) => e + 1);
      wifiAutoReconnectEnabledRef.current = true;
      logWifiDiag("[DeviceConn] createRxPlayback OK; WiFi path ready");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      logWifiDiag("[DeviceConn] connectViaWifi catch: " + err);
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      await ws.disconnect().catch(() => {});
      setConnecting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    connectViaWifiRef.current = connectViaWifi;
  }, [connectViaWifi]);

  const disconnect = useCallback(async () => {
    clearWifiAutoReconnect();
    if (connectionType === "ble") await ble.disconnect();
    if (connectionType === "usb") await serial.disconnectSerial();
    if (connectionType === "wifi") await ws.disconnect();
    rxPlaybackHandleRef.current?.destroy();
    rxPlaybackHandleRef.current = null;
    setRxPlaybackEpoch((e) => e + 1);
    setConnectionType(null);
    setDeviceName(null);
  }, [clearWifiAutoReconnect, connectionType]);

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
