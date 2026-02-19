/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HARDWARE BOARD TYPE REGISTRY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When the app connects to a hardware board via USB-C, it sends a config
 * command and waits for the board's identification reply.
 *
 * HOW TO ADD A REAL BOARD TYPE
 * ─────────────────────────────
 * 1. Send a config/identify command to the board over USB serial.
 *    (The exact command format depends on the firmware — update here once known.)
 *
 * 2. The board replies with a string identifier.
 *    Example expected replies (PLACEHOLDER — update with real strings):
 *
 *      "BOARD_VHF_V1"   → VHF 2m board   (144–148 MHz)
 *      "BOARD_UHF_V1"   → UHF 70cm board (430–440 MHz)
 *      "BOARD_DUAL_V1"  → Dual-band board (both VHF + UHF)
 *
 *    Update the `BOARD_REGISTRY` map below with the real reply strings
 *    once you have them from the firmware team.
 *
 * 3. The registry maps the reply string → BandConfig, which drives:
 *      - Automatic frequency filtering in Contacts / Repeater Browser
 *      - Band label displayed in the ConnectionStatus header chip
 *      - (Future) TX power limits, step sizes, etc.
 *
 * BAND FREQUENCY RANGES
 * ─────────────────────
 * These ranges follow the ITU Region 1/2/3 amateur band plans:
 *   VHF 2m  : 144.000 – 148.000 MHz  (Region 2 upper limit; Region 1 is 144–146)
 *   UHF 70cm: 430.000 – 440.000 MHz
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type BandId = "VHF" | "UHF" | "DUAL" | null;

export interface BandConfig {
  /** Human-readable label shown in the UI */
  label: string;
  /** Short badge text for the header chip, e.g. "2m" */
  badge: string;
  /** Minimum frequency (MHz) for this band */
  minMHz: number;
  /** Maximum frequency (MHz) for this band */
  maxMHz: number;
  /** Colour token (HSL) for the band badge */
  color: string;
}

/** Frequency ranges per band */
export const BAND_CONFIGS: Record<Exclude<BandId, null | "DUAL">, BandConfig> = {
  VHF: {
    label: "VHF 2m",
    badge: "2m",
    minMHz: 144.0,
    maxMHz: 148.0,
    color: "hsl(200 80% 55%)",
  },
  UHF: {
    label: "UHF 70cm",
    badge: "70cm",
    minMHz: 430.0,
    maxMHz: 440.0,
    color: "hsl(270 70% 65%)",
  },
};

/**
 * BOARD_REGISTRY
 * ──────────────
 * Maps the raw reply string received from the hardware board to a BandId.
 *
 * ⚠️  PLACEHOLDER VALUES — replace with real firmware reply strings.
 *
 * To add a new board:
 *   1. Connect the board and capture its reply to the identify command.
 *   2. Add an entry: { "REAL_REPLY_STRING": "VHF" | "UHF" | "DUAL" }
 */
export const BOARD_REGISTRY: Record<string, BandId> = {
  // ── VHF boards ─────────────────────────────────────────────────────────
  // TODO: Replace with real firmware reply strings
  "BOARD_VHF_V1": "VHF",   // placeholder
  "QRP_VHF_144":  "VHF",   // placeholder

  // ── UHF boards ─────────────────────────────────────────────────────────
  // TODO: Replace with real firmware reply strings
  "BOARD_UHF_V1": "UHF",   // placeholder
  "QRP_UHF_430":  "UHF",   // placeholder

  // ── Dual-band boards ───────────────────────────────────────────────────
  // TODO: Replace with real firmware reply strings
  "BOARD_DUAL_V1": "DUAL", // placeholder — no frequency filtering applied
};

/**
 * Resolve the board type from a raw hardware reply string.
 * Returns null if the reply is not recognised (no filtering applied).
 */
export function resolveBoardType(rawReply: string): BandId {
  return BOARD_REGISTRY[rawReply.trim()] ?? null;
}

/**
 * Check whether a frequency (MHz) falls within the active band's range.
 * Returns true if no band is locked (null / DUAL) — show everything.
 */
export function frequencyMatchesBand(freqMHz: number, band: BandId): boolean {
  if (!band || band === "DUAL") return true;
  const cfg = BAND_CONFIGS[band];
  return freqMHz >= cfg.minMHz && freqMHz <= cfg.maxMHz;
}
