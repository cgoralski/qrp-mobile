import { Usb } from "lucide-react";
import type { BandId } from "@/lib/hardware";
import { BAND_CONFIGS } from "@/lib/hardware";

interface ConnectionStatusProps {
  connected: boolean;
  /** Band detected from the connected hardware board. Null = no board / unknown. */
  boardBand?: BandId;
}

const ConnectionStatus = ({ connected, boardBand }: ConnectionStatusProps) => {
  const bandCfg = boardBand && boardBand !== "DUAL" ? BAND_CONFIGS[boardBand] : null;
  const dualBand = boardBand === "DUAL";

  return (
    <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-1.5">
      <div
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          connected
            ? "bg-signal shadow-[0_0_6px_hsl(142_70%_50%/0.6)] animate-pulse-glow"
            : "bg-muted-foreground/50"
        }`}
      />
      <Usb className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {connected ? "Connected" : "No device"}
      </span>

      {/* Band badge — shown only when a board is connected and identified */}
      {connected && (bandCfg || dualBand) && (
        <span
          className="font-mono-display font-bold tracking-wider"
          style={{
            fontSize: "9px",
            padding: "1px 6px",
            borderRadius: "9999px",
            background: dualBand
              ? "hsl(185 80% 55% / 0.15)"
              : `${bandCfg!.color.replace(")", " / 0.15)")}`,
            border: dualBand
              ? "1px solid hsl(185 80% 55% / 0.35)"
              : `1px solid ${bandCfg!.color.replace(")", " / 0.35)")}`,
            color: dualBand ? "hsl(185 80% 55%)" : bandCfg!.color,
          }}
        >
          {dualBand ? "DUAL" : bandCfg!.badge}
        </span>
      )}
    </div>
  );
};

export default ConnectionStatus;
