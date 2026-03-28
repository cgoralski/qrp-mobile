import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useSerialLog, type SerialLogEntry } from "@/contexts/SerialLogContext";
import type { SerialLogMessageType } from "@/lib/serial-log-decode";

const SERIAL_LOG_FILTER_KEY = "kv4p_serial_log_filters";

export type SerialLogFilterCategory =
  | "audio"
  | "smeter"
  | "control"
  | "debug"
  | "raw"
  | "other";

const CATEGORIES: { id: SerialLogFilterCategory; label: string; color: string; bg: string }[] = [
  { id: "audio", label: "Audio", color: "hsl(35 90% 55%)", bg: "hsl(35 90% 55% / 0.18)" },
  { id: "smeter", label: "S-meter", color: "hsl(165 70% 45%)", bg: "hsl(165 70% 45% / 0.18)" },
  { id: "control", label: "Control", color: "hsl(220 70% 58%)", bg: "hsl(220 70% 58% / 0.18)" },
  { id: "debug", label: "Debug", color: "hsl(280 50% 65%)", bg: "hsl(280 50% 65% / 0.18)" },
  { id: "raw", label: "Raw", color: "hsl(0 0% 55%)", bg: "hsl(0 0% 55% / 0.15)" },
  { id: "other", label: "Other", color: "hsl(25 75% 55%)", bg: "hsl(25 75% 55% / 0.18)" },
];

const TYPE_TO_CATEGORY: Record<SerialLogMessageType, SerialLogFilterCategory> = {
  rx_audio: "audio",
  tx_audio: "audio",
  smeter: "smeter",
  hello: "control",
  version: "control",
  window_update: "control",
  config: "control",
  rssi: "control",
  stop: "control",
  group: "control",
  filters: "control",
  ptt_down: "control",
  ptt_up: "control",
  hl: "control",
  phys_ptt_down: "control",
  phys_ptt_up: "control",
  debug: "debug",
  raw: "raw",
  other: "other",
};

const DEFAULT_FILTERS: Record<SerialLogFilterCategory, boolean> = {
  audio: true,
  smeter: true,
  control: true,
  debug: true,
  raw: true,
  other: true,
};

function loadFilters(): Record<SerialLogFilterCategory, boolean> {
  if (typeof localStorage === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(SERIAL_LOG_FILTER_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<Record<SerialLogFilterCategory, boolean>>;
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: Record<SerialLogFilterCategory, boolean>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SERIAL_LOG_FILTER_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 12);
}

function isPrintable(b: number): boolean {
  return (b >= 0x20 && b <= 0x7e) || b === 0x0d || b === 0x0a || b === 0x09;
}

function formatChunk(data: Uint8Array): string {
  if (data.length === 0) return "";
  const allPrintable = Array.from(data).every(isPrintable);
  if (allPrintable) {
    return Array.from(data)
      .map((b) => (b === 0x0a ? "\n" : b === 0x0d ? "" : String.fromCharCode(b)))
      .join("")
      .replace(/\n$/, "↵")
      .trimEnd();
  }
  const hex = Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  return data.length <= 24 ? hex : hex.slice(0, 72) + "…";
}

function LogLine({
  entry,
  messageColor,
}: {
  entry: SerialLogEntry;
  messageColor: string;
}) {
  const text =
    entry.displayText !== undefined && entry.displayText !== ""
      ? entry.displayText
      : formatChunk(entry.data) || `(${entry.data.length} bytes)`;
  const isRx = entry.dir === "rx";
  return (
    <div
      className="flex gap-2 py-0.5 font-mono text-xs leading-relaxed break-all"
      data-dir={entry.dir}
    >
      <span className="shrink-0 text-muted-foreground tabular-nums">
        {formatTime(entry.ts)}
      </span>
      <span
        className="shrink-0 w-7 font-semibold"
        style={{
          color: isRx ? "hsl(140 60% 50%)" : "hsl(220 70% 60%)",
        }}
      >
        {isRx ? "RX" : "TX"}
      </span>
      <span
        className="min-w-0"
        style={{ wordBreak: "break-all", color: messageColor }}
      >
        {text}
      </span>
    </div>
  );
}

export default function SerialLogScreen() {
  const { connectionType } = useDeviceConnection();
  const serialLog = useSerialLog();
  const containerRef = useRef<HTMLDivElement>(null);
  const isUsb = connectionType === "usb";
  const [filters, setFilters] = useState<Record<SerialLogFilterCategory, boolean>>(loadFilters);

  const toggleFilter = useCallback((category: SerialLogFilterCategory) => {
    setFilters((prev) => {
      const next = { ...prev, [category]: !prev[category] };
      saveFilters(next);
      return next;
    });
  }, []);

  // Subscribe to version so we re-render when new entries are flushed
  const version = serialLog?.version ?? 0;

  useEffect(() => {
    if (!serialLog || !containerRef.current) return;
    const el = containerRef.current;
    el.scrollTop = el.scrollHeight;
  }, [serialLog, version]);

  if (!serialLog) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6">
        <Terminal className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center">
          Serial log unavailable.
        </p>
      </div>
    );
  }

  if (!isUsb) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
        <Terminal className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground text-center max-w-[280px]">
          Connect via USB to see the live serial stream from the board.
        </p>
        <p className="text-xs text-muted-foreground/70 text-center max-w-[260px]">
          Use the connect button in the header and choose the serial port. RX/TX
          traffic will appear here in real time.
        </p>
      </div>
    );
  }

  const entriesList = serialLog.entriesRef.current;
  void version; // subscribe: re-render when log is flushed

  const filteredEntries = entriesList.filter((entry) => {
    const category = TYPE_TO_CATEGORY[entry.messageType];
    return filters[category];
  });

  return (
    <div className="flex flex-1 flex-col min-h-0 px-1 pt-2 pb-1">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="tab-section-title">Serial log</span>
        </div>
        <button
          type="button"
          onClick={serialLog.clear}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          title="Clear log"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border/40">
        {CATEGORIES.map(({ id, label, color, bg }) => (
          <button
            key={id}
            type="button"
            onClick={() => toggleFilter(id)}
            className="rounded-md px-2.5 py-1 text-[10px] font-medium transition-all border"
            style={{
              borderColor: filters[id] ? color : "hsl(0 0% 30%)",
              background: filters[id] ? bg : "hsl(0 0% 14%)",
              color: filters[id] ? color : "hsl(0 0% 55%)",
            }}
            title={filters[id] ? `Hide ${label}` : `Show ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mt-2 px-3 py-2 rounded-lg bg-black/30 font-mono text-[11px] leading-relaxed"
        style={{
          border: "1px solid hsl(220 10% 22%)",
        }}
      >
        {filteredEntries.length === 0 ? (
          <p className="text-muted-foreground/70">
            {entriesList.length === 0 ? "Waiting for data…" : "No entries match the current filters."}
          </p>
        ) : (
          filteredEntries.map((entry) => (
            <LogLine
              key={entry.id}
              entry={entry}
              messageColor={CATEGORIES.find((c) => c.id === TYPE_TO_CATEGORY[entry.messageType])?.color ?? "hsl(0 0% 85%)"}
            />
          ))
        )}
      </div>
    </div>
  );
}
