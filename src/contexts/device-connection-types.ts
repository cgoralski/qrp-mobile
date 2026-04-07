import type { MutableRefObject } from "react";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";

export type ConnectionType = "usb" | "ble" | "wifi" | null;

export interface DeviceConnectionContextValue {
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
  rxPlaybackHandleRef: MutableRefObject<RxPlaybackHandle | null>;
  rxPlaybackEpoch: number;
}
