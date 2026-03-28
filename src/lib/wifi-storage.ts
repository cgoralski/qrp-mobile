/**
 * Persist last-used WiFi board host/port so we can "Connect to board" with one tap.
 */

const KEY_HOST = "kv4p_wifi_host";
const KEY_PORT = "kv4p_wifi_port";
const DEFAULT_PORT = 8765;

export function getSavedWifiHost(): string | null {
  if (typeof localStorage === "undefined") return null;
  const host = localStorage.getItem(KEY_HOST);
  return host && host.trim() ? host.trim() : null;
}

export function getSavedWifiPort(): number {
  if (typeof localStorage === "undefined") return DEFAULT_PORT;
  const raw = localStorage.getItem(KEY_PORT);
  if (raw == null) return DEFAULT_PORT;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n <= 0 ? DEFAULT_PORT : n;
}

export function setSavedWifiHost(host: string, port?: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY_HOST, host.trim());
  if (port != null && port > 0) {
    localStorage.setItem(KEY_PORT, String(port));
  }
}

/**
 * Save host (and optional port) from a WebSocket URL (e.g. ws://192.168.4.1:8765).
 */
export function saveWifiHostFromUrl(url: string): void {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = u.port ? parseInt(u.port, 10) : DEFAULT_PORT;
    if (host) setSavedWifiHost(host, Number.isNaN(port) ? undefined : port);
  } catch {
    /* ignore invalid URL */
  }
}
