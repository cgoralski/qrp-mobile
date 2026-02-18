import { useState, useEffect } from "react";
import { Battery, Bluetooth, Zap, Music } from "lucide-react";

interface RadioScreenProps {
  channelA: string;
  channelB: string;
  onChannelAChange: (value: string) => void;
  onChannelBChange: (value: string) => void;
  activeChannel: "A" | "B";
  onActiveChannelChange: (channel: "A" | "B") => void;
  rssi: number;
  isTransmitting?: boolean;
}

const formatFreq = (value: string): { main: string; sub: string } => {
  if (!value) return { main: "000.000", sub: "00" };
  const parts = value.split(".");
  const integer = parts[0].padStart(3, "0");
  const decimal = (parts[1] || "").padEnd(3, "0").slice(0, 3);
  const sub = (parts[1] || "").slice(3, 5).padEnd(2, "0");
  return { main: `${integer}.${decimal}`, sub };
};

const RSSIBar = ({ level, label }: { level: number; label: string }) => (
  <div className="flex items-end gap-[1.5px] mt-1">
    <span className="font-mono-display text-[7px] text-white/30 mr-1 mb-[1px]">{label}</span>
    {Array.from({ length: 10 }).map((_, i) => (
      <div
        key={i}
        className="transition-all duration-100"
        style={{
          width: "3px",
          height: `${3 + i * 1.2}px`,
          borderRadius: "0.5px",
          background: i < level
            ? i < 4
              ? "hsl(0 0% 75%)"
              : i < 7
              ? "hsl(45 80% 60%)"
              : "hsl(0 70% 55%)"
            : "hsl(0 0% 20%)",
        }}
      />
    ))}
    <div className="flex items-end ml-1 gap-[6px]">
      {["1", "3", "5", "7", "9"].map((n) => (
        <span key={n} className="font-mono-display text-[5px] text-white/20 leading-none">{n}</span>
      ))}
    </div>
  </div>
);

const ChannelBlock = ({
  label,
  badgeColor,
  frequency,
  isActive,
  modeLeft,
  modeRight,
  tags,
  rssi,
  tint,
  onClick,
}: {
  label: string;
  badgeColor: string;
  frequency: string;
  isActive: boolean;
  modeLeft: string;
  modeRight: string;
  tags?: string[];
  rssi: number;
  tint: "amber" | "green";
  onClick: () => void;
}) => {
  const freq = formatFreq(frequency);

  const tintColor = tint === "amber"
    ? "hsl(42 90% 58%)"
    : "hsl(140 70% 52%)";

  const activeFreqStyle = isActive
    ? {
        color: tintColor,
        textShadow: `0 0 8px ${tintColor}99, 0 0 20px ${tintColor}44`,
      }
    : {
        color: "hsl(0 0% 55%)",
        textShadow: "none",
      };

  const activeSubStyle = isActive
    ? { color: `${tintColor}bb`, textShadow: `0 0 6px ${tintColor}55` }
    : { color: "hsl(0 0% 35%)" };

  return (
    <div
      className={`flex flex-col px-3 py-1 cursor-pointer transition-all ${
        isActive ? "" : "opacity-60"
      }`}
      onClick={onClick}
    >
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-3 mb-0.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="font-mono-display text-[8px] font-semibold tracking-wider text-white/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-baseline gap-0">
        <span
          className={`inline-flex h-[20px] w-[20px] items-center justify-center rounded-sm text-[11px] font-black mr-2 ${badgeColor}`}
        >
          {label}
        </span>
        <span
          className="font-freq-display text-[34px] leading-none transition-all duration-300 sm:text-[40px]"
          style={activeFreqStyle}
        >
          {freq.main}
        </span>
        <span
          className="font-freq-display text-[17px] ml-0.5 transition-all duration-300 sm:text-[20px]"
          style={activeSubStyle}
        >
          {freq.sub}
        </span>
      </div>

      <div className="flex items-center justify-between mt-0.5">
        <span className="font-mono-display text-[9px] font-semibold tracking-wider text-white/40">
          {modeLeft}
        </span>
        <span className="font-mono-display text-[9px] font-semibold tracking-wider text-white/40">
          {modeRight}
        </span>
      </div>

      <RSSIBar level={rssi} label="RSSI" />
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
  isTransmitting = false,
}: RadioScreenProps) => {
  const [animatedRssi, setAnimatedRssi] = useState(rssi);

  useEffect(() => {
    // Smoothly drift the animated value toward the real rssi
    setAnimatedRssi(rssi);
  }, [rssi]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedRssi((prev) => {
        // Small random walk ±1 around the base rssi, clamped 1–10
        const delta = Math.random() < 0.5 ? -1 : 1;
        const next = prev + delta;
        return Math.max(1, Math.min(10, next));
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    /* Outer bezel — textured dark hardware casing */
    <div
      className="w-full rounded-[18px] p-[10px] relative"
      style={{
        background:
          "linear-gradient(160deg, hsl(220 10% 17%) 0%, hsl(220 8% 12%) 50%, hsl(220 8% 9%) 100%)",
        border: "1px solid hsl(220 8% 24%)",
        boxShadow:
          "inset 0 1px 0 hsl(0 0% 40% / 0.2), inset 0 -1px 0 hsl(0 0% 5% / 0.7), inset 1px 0 0 hsl(0 0% 30% / 0.15), inset -1px 0 0 hsl(0 0% 5% / 0.5), 0 16px 48px hsl(220 30% 2% / 0.95), 0 6px 20px hsl(220 20% 2% / 0.7)",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E\"), linear-gradient(160deg, hsl(220 10% 17%) 0%, hsl(220 8% 12%) 50%, hsl(220 8% 9%) 100%)",
        backgroundBlendMode: "overlay, normal",
      }}
    >
      {/* Top sheen highlight */}
      <div
        className="absolute inset-x-6 top-[5px] h-[1px] rounded-full pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 70% / 0.12), transparent)" }}
      />

      {/* Inner LCD screen recess */}
      <div
        className="w-full rounded-xl overflow-hidden relative"
        style={{
          background: "linear-gradient(180deg, hsl(218 55% 16%) 0%, hsl(220 52% 13%) 100%)",
          border: "1px solid hsl(218 45% 28%)",
          boxShadow:
            "inset 0 3px 10px hsl(220 60% 5% / 0.7), inset 0 1px 4px hsl(220 50% 5% / 0.5), inset 0 0 40px hsl(218 60% 12% / 0.5)",
        }}
      >
        {/* Vignette / inner glow */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, transparent 55%, hsl(220 30% 2% / 0.45) 100%)",
          }}
        />
        {/* RX green bloom — glows when receiving */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl transition-opacity duration-300"
          style={{
            opacity: !isTransmitting && animatedRssi > 3 ? 1 : 0,
            background:
              "radial-gradient(ellipse at 50% 40%, hsl(140 70% 45% / 0.14) 0%, hsl(140 60% 40% / 0.05) 50%, transparent 75%)",
            boxShadow:
              !isTransmitting && animatedRssi > 3
                ? "inset 0 0 24px hsl(140 70% 45% / 0.08)"
                : "none",
          }}
        />
        {/* TX red bloom — glows when transmitting */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl transition-opacity duration-150"
          style={{
            opacity: isTransmitting ? 1 : 0,
            background:
              "radial-gradient(ellipse at 50% 40%, hsl(var(--transmit) / 0.18) 0%, hsl(var(--transmit) / 0.06) 50%, transparent 75%)",
            boxShadow: isTransmitting
              ? "inset 0 0 24px hsl(var(--transmit) / 0.12)"
              : "none",
          }}
        />
        {/* Top status icons */}
        <div className="flex items-center gap-3 px-3 py-1 border-b border-white/[0.06]">
          <Zap className="h-3 w-3 text-red-400/70" />
          <span className="font-mono-display text-[10px] font-bold text-white/40">Z</span>
          <Music className="h-3 w-3 text-white/30" />
          <Bluetooth className="h-3 w-3 text-white/30" />
          <div className="flex-1" />
          {/* RX indicator */}
          <span
            className="font-mono-display text-[10px] font-black tracking-widest transition-all duration-100"
            style={
              !isTransmitting && animatedRssi > 3
                ? {
                    color: "hsl(140 70% 52%)",
                    textShadow:
                      "0 0 6px hsl(140 70% 52% / 0.9), 0 0 14px hsl(140 70% 52% / 0.5)",
                  }
                : { color: "hsl(0 0% 20%)" }
            }
          >
            RX
          </span>
          {/* TX indicator */}
          <span
            className="font-mono-display text-[10px] font-black tracking-widest transition-all duration-100"
            style={
              isTransmitting
                ? {
                    color: "hsl(0 100% 70%)",
                    textShadow:
                      "0 0 8px hsl(0 100% 65% / 1), 0 0 20px hsl(0 100% 55% / 0.8), 0 0 40px hsl(0 100% 50% / 0.4)",
                  }
                : { color: "hsl(0 0% 20%)" }
            }
          >
            TX
          </span>
          <Battery className="h-3 w-3 text-signal" />
        </div>

        {/* Channel A */}
        <ChannelBlock
          label="A"
          badgeColor="bg-emerald-600 text-white"
          frequency={channelA}
          isActive={activeChannel === "A"}
          modeLeft="VFO Mode"
          modeRight="VFO"
          tags={["H", "R 🔴"]}
          rssi={activeChannel === "A" ? animatedRssi : 2}
          tint="green"
          onClick={() => onActiveChannelChange("A")}
        />

        {/* Divider */}
        <div
          className="h-px mx-2"
          style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 30% / 0.4), transparent)" }}
        />

        {/* Channel B */}
        <ChannelBlock
          label="B"
          badgeColor="bg-amber-600 text-white"
          frequency={channelB}
          isActive={activeChannel === "B"}
          modeLeft="CH Mode"
          modeRight="Zone1 DD1"
          tags={["DCS", "W —", "AM"]}
          rssi={activeChannel === "B" ? animatedRssi : 3}
          tint="amber"
          onClick={() => onActiveChannelChange("B")}
        />

        {/* Bottom bar */}
        <div className="flex items-center px-3 py-1 border-t border-white/[0.06]">
          {["VOX", "APRS", "MO", "TW"].map((tag, i) => (
            <span
              key={tag}
              className={`font-mono-display text-[9px] font-bold tracking-[0.12em] mr-4 ${
                i === 0 ? "text-white/60" : "text-white/25"
              }`}
            >
              {tag}
            </span>
          ))}
          <div className="flex-1" />
          <span className="font-mono-display text-[9px] text-white/25">🔒</span>
        </div>
      </div>
    </div>
  );
};

export default RadioScreen;
