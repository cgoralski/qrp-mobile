/**
 * In-memory log for Wi‑Fi / WebSocket connection diagnostics (Wi‑Fi Console page).
 * No PII; safe to copy and share for debugging.
 */

export interface WifiDiagEntry {
  ts: number;
  message: string;
}

const MAX_ENTRIES = 800;
let entries: WifiDiagEntry[] = [];
const listeners = new Set<() => void>();

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
