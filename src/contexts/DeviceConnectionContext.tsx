import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as ble from "@/lib/ble-device";
import * as serial from "@/lib/serial-device";
import * as ws from "@/lib/websocket-device";
import { saveWifiHostFromUrl } from "@/lib/wifi-storage";
import { createRxPlayback, type RxPlaybackHandle } from "@/lib/rx-audio-playback";
import { getPersistedRadioState } from "@/lib/radio-storage";
import { useSerialLog } from "@/contexts/SerialLogContext";

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
  /** RX playback handle created when user clicks Connect (USB). Cleared on disconnect. */
  rxPlaybackHandleRef: React.MutableRefObject<RxPlaybackHandle | null>;
}

const DeviceConnectionContext = createContext<DeviceConnectionContextValue | null>(null);

export function DeviceConnectionProvider({ children }: { children: ReactNode }) {
  const [connectionType, setConnectionType] = useState<ConnectionType>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDataRef = useRef<((data: Uint8Array) => void) | null>(null);
  const rxPlaybackHandleRef = useRef<RxPlaybackHandle | null>(null);
  const serialLog = useSerialLog();

  const connected = connectionType !== null;

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

  // WebSocket (WiFi) callbacks
  useEffect(() => {
    ws.setCallbacks({
      onConnect: (url) => {
        saveWifiHostFromUrl(url);
        ble.disconnect().catch(() => {});
        serial.disconnectSerial().catch(() => {});
        setConnectionType("wifi");
        setDeviceName("WiFi");
        setConnecting(false);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionType((prev) => {
          if (prev === "wifi") setDeviceName(null);
          return prev === "wifi" ? null : prev;
        });
        setConnecting(false);
      },
      onError: (msg) => {
        setConnecting(false);
        setError(msg);
      },
      onData: (data) => onDataRef.current?.(data),
    });
    return () => ws.setCallbacks({});
  }, []);

  // BLE callbacks
  useEffect(() => {
    ble.setCallbacks({
      onConnect: (name) => {
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
  }, []);

  // Serial callbacks. No auto-reconnect: user must tap "Connect to device" each time (including after refresh).
  useEffect(() => {
    serial.setSerialCallbacks({
      onConnect: () => {
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
  }, [serialLog?.appendRx, serialLog?.appendTx]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      await ble.connect();
    } catch {
      setConnecting(false);
    }
  }, []);

  const connectViaUsb = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      const { volume: savedVolume } = getPersistedRadioState();
      const handle = await createRxPlayback(savedVolume);
      rxPlaybackHandleRef.current = handle;
      await serial.disconnectSerial();
      await serial.connectSerial();
    } catch (e) {
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      setConnecting(false);
    }
  }, []);

  const connectViaWifi = useCallback(async (hostOrUrl: string, port?: number) => {
    setError(null);
    setConnecting(true);
    try {
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      const { volume: savedVolume } = getPersistedRadioState();
      const handle = await createRxPlayback(savedVolume);
      rxPlaybackHandleRef.current = handle;
      await ws.connect(hostOrUrl, port);
    } catch (e) {
      rxPlaybackHandleRef.current?.destroy();
      rxPlaybackHandleRef.current = null;
      setConnecting(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectionType === "ble") await ble.disconnect();
    if (connectionType === "usb") await serial.disconnectSerial();
    if (connectionType === "wifi") await ws.disconnect();
    rxPlaybackHandleRef.current?.destroy();
    rxPlaybackHandleRef.current = null;
    setConnectionType(null);
    setDeviceName(null);
  }, [connectionType]);

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
