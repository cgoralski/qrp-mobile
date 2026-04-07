import { WifiOff, CloudOff, MapPinOff } from "lucide-react";

export type CloudFeaturesBannerKind = "offline" | "cloud" | "tiles";

interface CloudFeaturesBannerProps {
  /** offline = no browser network; cloud = Supabase/API failed while “online”; tiles = map tiles failed */
  kind: CloudFeaturesBannerKind | null;
  className?: string;
}

/**
 * Explains that cloud/map features may be unavailable while the KV4P radio link (local Wi‑Fi) can still work.
 */
export function CloudFeaturesBanner({ kind, className = "" }: CloudFeaturesBannerProps) {
  if (!kind) return null;

  const Icon = kind === "offline" ? WifiOff : kind === "tiles" ? MapPinOff : CloudOff;
  const title =
    kind === "offline"
      ? "No network reported"
      : kind === "tiles"
        ? "Map basemap unavailable"
        : "Cloud data unavailable";

  const body =
    kind === "offline"
      ? "Maps, repeater directory, and sync need internet (often cellular while you stay on KV4P-Radio). Voice and radio over local Wi‑Fi may still work."
      : kind === "tiles"
        ? "OpenStreetMap tiles need internet. Your GPS position can still update below. Radio on KV4P-Radio is separate from map downloads."
        : "Could not reach the database or API. Showing cached data if available. Check cellular data or a Wi‑Fi network with internet. Local radio control is unchanged.";

  return (
    <div
      role="status"
      className={`flex gap-2.5 px-3 py-2.5 text-sm rounded-lg border border-amber-500/35 bg-amber-950/40 text-amber-100/95 ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5 text-amber-400/90" aria-hidden />
      <div className="min-w-0">
        <div className="font-semibold tracking-wide text-amber-100">{title}</div>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/80">{body}</p>
      </div>
    </div>
  );
}
