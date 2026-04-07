import { useNativeWifiRxStallRecovery, useRxAudioPlayback } from "@/hooks/useRxAudioPlayback";

/** Keeps KV4P RX Opus wired to Web Audio on every route (Index, Wi‑Fi console, etc.). */
export function RxAudioPlaybackHost() {
  useRxAudioPlayback();
  useNativeWifiRxStallRecovery();
  return null;
}
