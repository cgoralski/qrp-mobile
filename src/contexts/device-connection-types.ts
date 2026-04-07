import type { MutableRefObject } from "react";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";

export type ConnectionType = "usb" | "ble" | "wifi" | null;

/** Optional flags for `connectViaWifi` (e.g. post-PTT must tear down TCP even if URL matches). */
export type ConnectWifiOptions = { force?: boolean };

export interface DeviceConnectionContextValue {
  connected: boolean;
  connectionType: ConnectionType;
  deviceName: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  connectViaUsb: () => Promise<void>;
  connectViaWifi: (hostOrUrl: string, port?: number, opts?: ConnectWifiOptions) => Promise<void>;
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
