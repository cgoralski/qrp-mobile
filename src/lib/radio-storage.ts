/**
 * Persist last-used radio frequencies and channel names so they survive
 * disconnect, refresh, or rebuild. Load on app init; save when values change.
 */

const KEY = "kv4p_radio_state";

const VOLUME_MIN = 0.1;
const VOLUME_MAX = 3;
const VOLUME_DEFAULT = 1.5;

export interface PersistedRadioState {
  channelA: string;
  channelB: string;
  activeChannel: "A" | "B";
  channelAName: string;
  channelBName: string;
  /** Squelch level 0 (open)–8 (tight). DRA818 range. Per-VFO. */
  squelchA: number;
  squelchB: number;
  /** RX playback volume 0.1–3. Persisted so it survives reload. */
  volume: number;
}

const DEFAULTS: PersistedRadioState = {
  channelA: "433.00000",
  channelB: "435.00000",
  activeChannel: "A",
  channelAName: "REPEATER 1",
  channelBName: "CALLING CH",
  squelchA: 0,
  squelchB: 0,
  volume: VOLUME_DEFAULT,
};

function clampVolume(n: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, n)) : VOLUME_DEFAULT;
}

function clampSquelch(n: number): number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 8 ? n : 0;
}

function isValidFreqStr(s: string): boolean {
  if (typeof s !== "string" || !s.trim()) return false;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0.001 && n <= 1999.9999;
}

export function getPersistedRadioState(): PersistedRadioState {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PersistedRadioState>;
    const legacySquelch = clampSquelch((parsed as { squelch?: number }).squelch);
    const squelchA =
      (parsed as Partial<PersistedRadioState>).squelchA !== undefined
        ? clampSquelch((parsed as Partial<PersistedRadioState>).squelchA!)
        : legacySquelch;
    const squelchB =
      (parsed as Partial<PersistedRadioState>).squelchB !== undefined
        ? clampSquelch((parsed as Partial<PersistedRadioState>).squelchB!)
        : legacySquelch;
    const volume =
      (parsed as Partial<PersistedRadioState>).volume !== undefined
        ? clampVolume((parsed as Partial<PersistedRadioState>).volume!)
        : DEFAULTS.volume;
    return {
      channelA: typeof parsed.channelA === "string" && isValidFreqStr(parsed.channelA) ? String(parsed.channelA).trim() : DEFAULTS.channelA,
      channelB: typeof parsed.channelB === "string" && isValidFreqStr(parsed.channelB) ? String(parsed.channelB).trim() : DEFAULTS.channelB,
      activeChannel: parsed.activeChannel === "B" ? "B" : "A",
      channelAName: typeof parsed.channelAName === "string" && parsed.channelAName.trim().length > 0 ? parsed.channelAName.trim().slice(0, 32) : DEFAULTS.channelAName,
      channelBName: typeof parsed.channelBName === "string" && parsed.channelBName.trim().length > 0 ? parsed.channelBName.trim().slice(0, 32) : DEFAULTS.channelBName,
      squelchA,
      squelchB,
      volume,
    };
  } catch {
    return DEFAULTS;
  }
}

export function setPersistedRadioState(state: PersistedRadioState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Update only the persisted volume (e.g. after V+ / V-). Merges with current state. */
export function setPersistedVolume(volume: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const prev = getPersistedRadioState();
    setPersistedRadioState({ ...prev, volume: clampVolume(volume) });
  } catch {
    /* ignore */
  }
}
