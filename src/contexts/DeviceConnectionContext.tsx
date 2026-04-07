import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";
import type {
  ConnectWifiOptions,
  ConnectionType,
  DeviceConnectionContextValue,
} from "@/contexts/device-connection-types";
import { useSerialLog } from "@/contexts/SerialLogContext";
import {
  bumpSessionStat,
  logSession,
  noteRxPlaybackEpoch,
} from "@/lib/session-log";
import { assembleDeviceConnectionValue } from "@/contexts/device-connection/assemble-device-connection-value";
import { useDeviceBleSerialEffects } from "@/contexts/device-connection/use-device-ble-serial-effects";
import { useDeviceConnectionActions } from "@/contexts/device-connection/use-device-connection-actions";
import { useDeviceWifiEffects } from "@/contexts/device-connection/use-device-wifi-effects";

export type { ConnectionType } from "@/contexts/device-connection-types";

const DeviceConnectionContext = createContext<DeviceConnectionContextValue | null>(null);

export function DeviceConnectionProvider({ children }: { children: ReactNode }) {
  const [connectionType, setConnectionType] = useState<ConnectionType>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rxPlaybackEpoch, setRxPlaybackEpoch] = useState(0);
  const onDataRef = useRef<((data: Uint8Array) => void) | null>(null);
  const rxPlaybackHandleRef = useRef<RxPlaybackHandle | null>(null);
  const wifiAutoReconnectEnabledRef = useRef(false);
  const connectingRef = useRef(connecting);
  const connectionTypeRef = useRef(connectionType);
  const connectViaWifiRef = useRef<
    (host: string, port?: number, opts?: ConnectWifiOptions) => Promise<void>
  >(async () => {});
  const wifiDropReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialLog = useSerialLog();

  const connected = connectionType !== null;

  useEffect(() => {
    noteRxPlaybackEpoch(rxPlaybackEpoch);
  }, [rxPlaybackEpoch]);

  useEffect(() => {
    connectingRef.current = connecting;
  }, [connecting]);

  useEffect(() => {
    connectionTypeRef.current = connectionType;
  }, [connectionType]);

  const logRxDestroyIfAny = useCallback((reason: string) => {
    if (rxPlaybackHandleRef.current) {
      bumpSessionStat("rxPlaybackDestroyed");
      logSession("rx_playback_destroy", { reason });
    }
  }, []);

  const clearWifiAutoReconnect = useCallback(() => {
    wifiAutoReconnectEnabledRef.current = false;
  }, []);

  const actions = useDeviceConnectionActions({
    connectionType,
    setConnectionType,
    setDeviceName,
    setConnecting,
    setError,
    setRxPlaybackEpoch,
    onDataRef,
    rxPlaybackHandleRef,
    wifiAutoReconnectEnabledRef,
    wifiDropReconnectTimerRef,
    clearWifiAutoReconnect,
    logRxDestroyIfAny,
  });

  useDeviceWifiEffects({
    connectionType,
    setConnectionType,
    setDeviceName,
    setConnecting,
    setError,
    setRxPlaybackEpoch,
    onDataRef,
    rxPlaybackHandleRef,
    logRxDestroyIfAny,
    connectingRef,
    connectionTypeRef,
    wifiAutoReconnectEnabledRef,
    wifiDropReconnectTimerRef,
    connectViaWifiRef,
    connectViaWifi: actions.connectViaWifi,
  });

  useDeviceBleSerialEffects({
    clearWifiAutoReconnect,
    onDataRef,
    serialAppendRx: serialLog?.appendRx,
    serialAppendTx: serialLog?.appendTx,
    setConnectionType,
    setDeviceName,
    setConnecting,
    setError,
  });

  const value = assembleDeviceConnectionValue({
    connected,
    connectionType,
    deviceName,
    connecting,
    error,
    rxPlaybackEpoch,
    rxPlaybackHandleRef,
    connect: actions.connect,
    connectViaUsb: actions.connectViaUsb,
    connectViaWifi: actions.connectViaWifi,
    disconnect: actions.disconnect,
    clearError: actions.clearError,
    sendData: actions.sendData,
    setOnData: actions.setOnData,
  });

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
