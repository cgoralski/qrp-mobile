import type { MutableRefObject } from "react";
import * as serial from "@/lib/serial-device";
import * as ws from "@/lib/websocket-device";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";
import type {
  ConnectWifiOptions,
  ConnectionType,
  DeviceConnectionContextValue,
} from "@/contexts/device-connection-types";

export interface DeviceConnectionSlices {
  connected: boolean;
  connectionType: ConnectionType;
  deviceName: string | null;
  connecting: boolean;
  error: string | null;
  rxPlaybackEpoch: number;
  rxPlaybackHandleRef: MutableRefObject<RxPlaybackHandle | null>;
  connect: () => Promise<void>;
  connectViaUsb: () => Promise<void>;
  connectViaWifi: (hostOrUrl: string, port?: number, opts?: ConnectWifiOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  sendData: (data: Uint8Array) => Promise<void>;
  setOnData: (callback: ((data: Uint8Array) => void) | null) => void;
}

export function assembleDeviceConnectionValue(s: DeviceConnectionSlices): DeviceConnectionContextValue {
  return {
    connected: s.connected,
    connectionType: s.connectionType,
    deviceName: s.deviceName,
    connecting: s.connecting,
    error: s.error,
    connect: s.connect,
    connectViaUsb: s.connectViaUsb,
    connectViaWifi: s.connectViaWifi,
    disconnect: s.disconnect,
    clearError: s.clearError,
    isBluetoothSupported: false,
    isSerialSupported: serial.isSerialSupported(),
    isWifiSupported: ws.isWifiSupported(),
    sendData: s.sendData,
    setOnData: s.setOnData,
    rxPlaybackHandleRef: s.rxPlaybackHandleRef,
    rxPlaybackEpoch: s.rxPlaybackEpoch,
  };
}
