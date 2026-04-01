/**
 * Structured startup / Wi‑Fi settle diagnostics. Lines go to the same ring buffer as the Wi‑Fi console
 * (`logWifiDiag`) with prefix `[Session]` for filtering or eyeballing.
 */

import { logWifiDiag } from "@/lib/wifi-diagnostics";

let sessionT0Ms = 0;
let seq = 0;

/** Monotonic counters for the Wi‑Fi console summary strip. */
export const sessionStats = {
  wifiConnectStarted: 0,
  wifiConnectSuccess: 0,
  wifiConnectFailed: 0,
  wifiDisconnect: 0,
  wifiTransportError: 0,
  wifiAutoReconnectScheduled: 0,
  wifiAutoReconnectSkippedCooldown: 0,
  wifiAutoReconnectInvoked: 0,
  appStateInactive: 0,
  appStateActive: 0,
  foregroundReconnectTimerFired: 0,
  rxPlaybackDestroyed: 0,
  rxPlaybackEpochMax: 0,
  kv4pVersionReceived: 0,
  kv4pDisconnectedReset: 0,
};

const STAT_KEYS: (keyof typeof sessionStats)[] = [
  "wifiConnectStarted",
  "wifiConnectSuccess",
  "wifiConnectFailed",
  "wifiDisconnect",
  "wifiTransportError",
  "wifiAutoReconnectScheduled",
  "wifiAutoReconnectSkippedCooldown",
  "wifiAutoReconnectInvoked",
  "appStateInactive",
  "appStateActive",
  "foregroundReconnectTimerFired",
  "rxPlaybackDestroyed",
  "rxPlaybackEpochMax",
  "kv4pVersionReceived",
  "kv4pDisconnectedReset",
];

/** Call once from main.tsx when the bundle loads so elapsed times reflect cold start. */
export function initSessionLog(): void {
  sessionT0Ms = typeof performance !== "undefined" ? performance.now() : 0;
  seq = 0;
  for (const k of STAT_KEYS) {
    sessionStats[k] = 0;
  }
  logWifiDiag("[Session] initSessionLog (cold start baseline reset)");
}

function elapsedMs(): number {
  if (typeof performance === "undefined") return 0;
  if (sessionT0Ms === 0) sessionT0Ms = performance.now();
  return Math.round(performance.now() - sessionT0Ms);
}

function formatFields(fields?: Record<string, string | number | boolean | null | undefined>): string {
  if (!fields) return "";
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/**
 * One session line: `[Session +123ms #4] event key=value …`
 */
export function logSession(
  event: string,
  fields?: Record<string, string | number | boolean | null | undefined>
): void {
  seq += 1;
  logWifiDiag(`[Session +${elapsedMs()}ms #${seq}] ${event}${formatFields(fields)}`);
}

export function bumpSessionStat<K extends keyof typeof sessionStats>(key: K, delta: number = 1): void {
  sessionStats[key] += delta;
}

export function noteRxPlaybackEpoch(epoch: number): void {
  if (epoch > sessionStats.rxPlaybackEpochMax) {
    sessionStats.rxPlaybackEpochMax = epoch;
  }
}

export function getSessionStatsLine(): string {
  const s = sessionStats;
  return (
    `[Session summary] +${elapsedMs()}ms seq#${seq} | ` +
    `WiFi ok/fail ${s.wifiConnectSuccess}/${s.wifiConnectFailed} | ` +
    `disc/err ${s.wifiDisconnect}/${s.wifiTransportError} | ` +
    `autoReconn sched/skip/run ${s.wifiAutoReconnectScheduled}/${s.wifiAutoReconnectSkippedCooldown}/${s.wifiAutoReconnectInvoked} | ` +
    `app inact/act ${s.appStateInactive}/${s.appStateActive} fgTimer ${s.foregroundReconnectTimerFired} | ` +
    `rxDestroy ${s.rxPlaybackDestroyed} rxEpochMax ${s.rxPlaybackEpochMax} | ` +
    `kv4pVer/disconnectReset ${s.kv4pVersionReceived}/${s.kv4pDisconnectedReset}`
  );
}
