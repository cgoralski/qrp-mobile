import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import * as ble from "@/lib/ble-device";
import * as serial from "@/lib/serial-device";
import * as ws from "@/lib/websocket-device";
import { createRxPlayback, type RxPlaybackHandle } from "@/lib/rx-audio-playback";
import { getPersistedRadioState } from "@/lib/radio-storage";
import {
  bumpSessionStat,
  logSession,
} from "@/lib/session-log";
import { logWifiDiag } from "@/lib/wifi-diagnostics";
import type { ConnectionType } from "@/contexts/device-connection-types";

export interface UseDeviceConnectionActionsParams {
  connectionType: ConnectionType;
  setConnectionType: Dispatch<SetStateAction<ConnectionType>>;
  setDeviceName: Dispatch<SetStateAction<string | null>>;
  setConnecting: (v: boolean) => void;
  setError: (v: string | null) => void;
  setRxPlaybackEpoch: Dispatch<SetStateAction<number>>;
  onDataRef: MutableRefObject<((data: Uint8Array) => void) | null>;
  rxPlaybackHandleRef: MutableRefObject<RxPlaybackHandle | null>;
  wifiAutoReconnectEnabledRef: MutableRefObject<boolean>;
  wifiDropReconnectTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  clearWifiAutoReconnect: () => void;
  logRxDestroyIfAny: (reason: string) => void;
}

export interface DeviceConnectionActions {
  clearError: () => void;
  setOnData: (callback: ((data: Uint8Array) => void) | null) => void;
  sendData: (data: Uint8Array) => Promise<void>;
  connect: () => Promise<void>;
  connectViaUsb: () => Promise<void>;
  connectViaWifi: (hostOrUrl: string, port?: number) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useDeviceConnectionActions({
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
}: UseDeviceConnectionActionsParams): DeviceConnectionActions {
  const clearError = useCallback(() => setError(null), [setError]);

  const setOnData = useCallback((cb: ((data: Uint8Array) => void) | null) => {
    onDataRef.current = cb;
  }, [onDataRef]);

  const sendData = useCallback(
    async (data: Uint8Array) => {
      if (connectionType === "ble" && ble.isConnected()) {
        await ble.write(data);
      } else if (connectionType === "usb" && serial.isSerialConnected()) {
        await serial.writeSerial(data);
      } else if (connectionType === "wifi" && ws.isConnected()) {
        await ws.write(data);
      }
    },
    [connectionType]
  );

  const connect = useCallback(async () => {
    clearWifiAutoReconnect();
    setError(null);
    setConnecting(true);
    try {
      await ble.connect();
    } catch {
      setConnecting(false);
    }
  }, [clearWifiAutoReconnect, setConnecting, setError]);

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
  }, [clearWifiAutoReconnect, logRxDestroyIfAny, rxPlaybackHandleRef, setConnecting, setError, setRxPlaybackEpoch]);

  const connectViaWifi = useCallback(
    async (hostOrUrl: string, port?: number) => {
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
    },
    [logRxDestroyIfAny, rxPlaybackHandleRef, setConnecting, setError, setRxPlaybackEpoch, wifiAutoReconnectEnabledRef]
  );

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
  }, [
    clearWifiAutoReconnect,
    connectionType,
    logRxDestroyIfAny,
    rxPlaybackHandleRef,
    setConnectionType,
    setDeviceName,
    setRxPlaybackEpoch,
    wifiDropReconnectTimerRef,
  ]);

  return {
    clearError,
    setOnData,
    sendData,
    connect,
    connectViaUsb,
    connectViaWifi,
    disconnect,
  };
}
