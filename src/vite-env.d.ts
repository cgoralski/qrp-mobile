/// <reference types="vite/client" />

/* Web Serial API (see https://wicg.github.io/serial/) */
interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  addEventListener(type: "disconnect", listener: () => void): void;
}
interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}
