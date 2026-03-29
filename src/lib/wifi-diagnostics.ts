/**
 * In-memory log for Wi‑Fi / WebSocket connection diagnostics (Wi‑Fi Console page).
 * No PII; safe to copy and share for debugging.
 */

export interface WifiDiagEntry {
  ts: number;
  message: string;
}

/** Ring buffer size (lines). Large enough for long Wi‑Fi debug sessions; copy-all still exports full buffer. */
export const WIFI_DIAG_MAX_ENTRIES = 8000;

const MAX_ENTRIES = WIFI_DIAG_MAX_ENTRIES;
let entries: WifiDiagEntry[] = [];
const listeners = new Set<() => void>();

/** First `maxBytes` as hex + total length (for protocol debugging). */
export function previewBytesHex(u8: Uint8Array, maxBytes = 28): string {
  const n = Math.min(u8.length, maxBytes);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(u8[i]!.toString(16).padStart(2, "0"));
  const tail = u8.length > maxBytes ? " …" : "";
  return `${parts.join(" ")}${tail} (${u8.length}b)`;
}

function notify() {
  for (const l of listeners) l();
}

/** Append one line (timestamp added when displayed; here we store epoch ms). */
export function logWifiDiag(message: string): void {
  entries.push({ ts: Date.now(), message });
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
  notify();
}

export function subscribeWifiDiag(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getWifiDiagSnapshot(): WifiDiagEntry[] {
  return entries.slice();
}

export function clearWifiDiag(): void {
  entries = [];
  notify();
}

export function formatWifiDiagExport(lines: WifiDiagEntry[]): string {
  return lines
    .map((e) => `${new Date(e.ts).toISOString()}\t${e.message}`)
    .join("\n");
}
