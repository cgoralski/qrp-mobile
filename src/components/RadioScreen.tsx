import { Signal, Battery, Bluetooth, Wifi, Volume2 } from "lucide-react";

interface RadioScreenProps {
  channelA: string;
  channelB: string;
  onChannelAChange: (value: string) => void;
  onChannelBChange: (value: string) => void;
  activeChannel: "A" | "B";
  onActiveChannelChange: (channel: "A" | "B") => void;
  rssi: number; // 0-8
}

const formatFreq = (value: string): { integer: string; decimal: string; sub: string } => {
  if (!value) return { integer: "000", decimal: "000", sub: "00" };
  const parts = value.split(".");
  const integer = parts[0].padStart(3, "0");
  const decimal = (parts[1] || "").padEnd(3, "0").slice(0, 3);
  const sub = (parts[1] || "").slice(3, 5).padEnd(2, "0");
  return { integer, decimal, sub };
};

const RSSIBar = ({ level }: { level: number }) => (
  <div className="flex items-end gap-[2px]">
    <span className="font-mono-display text-[9px] text-muted-foreground mr-1">RSSI</span>
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className={`w-[4px] rounded-[1px] transition-all duration-100 ${
          i < level
            ? i < 3
              ? "bg-signal"
              : i < 6
              ? "bg-amber-400"
              : "bg-red-400"
            : "bg-muted-foreground/20"
        }`}
        style={{ height: `${4 + i * 1.5}px` }}
      />
    ))}
  </div>
);

const ChannelRow = ({
  label,
  color,
  frequency,
  isActive,
  mode,
  modeLabel,
  onClick,
}: {
  label: string;
  color: string;
  frequency: string;
  isActive: boolean;
  mode: string;
  modeLabel: string;
  onClick: () => void;
}) => {
  const freq = formatFreq(frequency);
  return (
    <div
      className={`flex flex-col gap-0.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
        isActive ? "bg-white/[0.04]" : "opacity-60"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-bold ${color}`}
          >
            {label}
          </span>
          <span className="font-mono-display text-[10px] text-muted-foreground tracking-wide">
            {modeLabel}
          </span>
        </div>
        <span className="font-mono-display text-[9px] text-muted-foreground tracking-wider">
          {mode}
        </span>
      </div>
      <div className="flex items-baseline">
        <span
          className={`font-mono-display text-[28px] font-bold tracking-[0.06em] leading-none sm:text-[34px] ${
            isActive ? "text-foreground" : "text-muted-foreground"
          }`}
          style={isActive ? { textShadow: "0 0 8px hsl(var(--glow-primary) / 0.3)" } : {}}
        >
          {freq.integer}.{freq.decimal}
        </span>
        <span
          className={`font-mono-display text-[16px] font-bold tracking-[0.04em] sm:text-[20px] ${
            isActive ? "text-foreground/70" : "text-muted-foreground/50"
          }`}
        >
          {freq.sub}
        </span>
      </div>
    </div>
  );
};

const RadioScreen = ({
  channelA,
  channelB,
  onChannelAChange,
  onChannelBChange,
  activeChannel,
  onActiveChannelChange,
  rssi,
}: RadioScreenProps) => {
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{
      background: "linear-gradient(180deg, hsl(210 25% 5%), hsl(210 20% 8%))",
      border: "1px solid hsl(210 15% 18% / 0.6)",
      boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.04), 0 8px 32px hsl(220 30% 3% / 0.6)",
    }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Signal className="h-3 w-3 text-muted-foreground" />
          <Bluetooth className="h-3 w-3 text-muted-foreground/40" />
          <Wifi className="h-3 w-3 text-muted-foreground/40" />
        </div>
        <RSSIBar level={rssi} />
        <div className="flex items-center gap-2">
          <Volume2 className="h-3 w-3 text-muted-foreground" />
          <Battery className="h-3 w-3 text-signal" />
        </div>
      </div>

      {/* Channel A */}
      <ChannelRow
        label="A"
        color="bg-amber-500 text-black"
        frequency={channelA}
        isActive={activeChannel === "A"}
        mode="FM"
        modeLabel="VFO Mode"
        onClick={() => onActiveChannelChange("A")}
      />

      {/* Divider */}
      <div className="h-px bg-border/20 mx-3" />

      {/* Channel B */}
      <ChannelRow
        label="B"
        color="bg-signal text-black"
        frequency={channelB}
        isActive={activeChannel === "B"}
        mode="AM"
        modeLabel="CH Mode"
        onClick={() => onActiveChannelChange("B")}
      />

      {/* Bottom info bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border/20">
        <div className="flex gap-2">
          {["VOX", "APRS", "MO", "TW"].map((tag) => (
            <span
              key={tag}
              className="font-mono-display text-[8px] font-semibold tracking-wider text-muted-foreground/50"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="font-mono-display text-[8px] text-muted-foreground/40 tracking-wider">
          Zone1 DD1
        </span>
      </div>
    </div>
  );
};

export default RadioScreen;
