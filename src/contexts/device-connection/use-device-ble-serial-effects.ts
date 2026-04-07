import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import * as ble from "@/lib/ble-device";
import * as serial from "@/lib/serial-device";
import * as ws from "@/lib/websocket-device";
import type { ConnectionType } from "@/contexts/device-connection-types";

export interface UseDeviceBleSerialEffectsParams {
  clearWifiAutoReconnect: () => void;
  onDataRef: MutableRefObject<((data: Uint8Array) => void) | null>;
  serialAppendRx?: (chunk: string) => void;
  serialAppendTx?: (chunk: string) => void;
  setConnectionType: Dispatch<SetStateAction<ConnectionType>>;
  setDeviceName: Dispatch<SetStateAction<string | null>>;
  setConnecting: (v: boolean) => void;
  setError: (v: string | null) => void;
}

/**
 * Registers global BLE + USB serial transport callbacks (mutually exclusive with Wi‑Fi path).
 */
export function useDeviceBleSerialEffects({
  clearWifiAutoReconnect,
  onDataRef,
  serialAppendRx,
  serialAppendTx,
  setConnectionType,
  setDeviceName,
  setConnecting,
  setError,
}: UseDeviceBleSerialEffectsParams): void {
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
  }, [
    clearWifiAutoReconnect,
    onDataRef,
    setConnecting,
    setConnectionType,
    setDeviceName,
    setError,
  ]);

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
      onSerialRxChunk: serialAppendRx,
      onSerialTxChunk: serialAppendTx,
    });
    return () => serial.setSerialCallbacks({});
  }, [
    clearWifiAutoReconnect,
    onDataRef,
    serialAppendRx,
    serialAppendTx,
    setConnecting,
    setConnectionType,
    setDeviceName,
    setError,
  ]);
}
