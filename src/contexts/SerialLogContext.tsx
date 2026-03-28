import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { decodeTxChunk, decodeRxChunk, type SerialLogMessageType } from "@/lib/serial-log-decode";

export interface SerialLogEntry {
  id: number;
  ts: number;
  dir: "rx" | "tx";
  data: Uint8Array;
  /** Human-readable message (decoded KV4P or empty to show raw). */
  displayText?: string;
  /** Message type for filtering and color-coding. */
  messageType: SerialLogMessageType;
}

const MAX_ENTRIES = 500;
const FLUSH_MS = 120;

interface SerialLogContextValue {
  /** Current log entries (read from ref when version changes). */
  entriesRef: React.MutableRefObject<SerialLogEntry[]>;
  /** Bump to force consumers to re-render and read entriesRef.current. */
  version: number;
  appendRx: (data: Uint8Array) => void;
  appendTx: (data: Uint8Array) => void;
  clear: () => void;
}

const SerialLogContext = createContext<SerialLogContextValue | null>(null);

let nextId = 0;

export function SerialLogProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef<SerialLogEntry[]>([]);
  const [version, setVersion] = useState(0);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<SerialLogEntry[]>([]);

  const flush = useCallback(() => {
    flushTimeoutRef.current = null;
    if (pendingRef.current.length === 0) return;
    const batch = pendingRef.current;
    pendingRef.current = [];
    const entries = entriesRef.current;
    for (const e of batch) {
      entries.push(e);
      if (entries.length > MAX_ENTRIES) entries.shift();
    }
    setVersion((v) => v + 1);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current != null) return;
    flushTimeoutRef.current = setTimeout(flush, FLUSH_MS);
  }, [flush]);

  const appendRx = useCallback(
    (data: Uint8Array) => {
      const ts = Date.now();
      const decoded = decodeRxChunk(data);
      for (const { text, data: slice, type } of decoded) {
        pendingRef.current.push({
          id: nextId++,
          ts,
          dir: "rx",
          data: slice.slice(0),
          displayText: text || undefined,
          messageType: type,
        });
      }
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const appendTx = useCallback(
    (data: Uint8Array) => {
      const ts = Date.now();
      const decoded = decodeTxChunk(data);
      for (const { text, data: slice, type } of decoded) {
        pendingRef.current.push({
          id: nextId++,
          ts,
          dir: "tx",
          data: slice.slice(0),
          displayText: text || undefined,
          messageType: type,
        });
      }
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const clear = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    pendingRef.current = [];
    entriesRef.current = [];
    setVersion((v) => v + 1);
  }, []);

  const value: SerialLogContextValue = {
    entriesRef,
    version,
    appendRx,
    appendTx,
    clear,
  };

  return (
    <SerialLogContext.Provider value={value}>{children}</SerialLogContext.Provider>
  );
}

export function useSerialLog(): SerialLogContextValue | null {
  return useContext(SerialLogContext);
}
