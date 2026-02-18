import { useState, useEffect, useRef } from "react";
import { Battery, Bluetooth, Zap, Music, Pencil, Check, Captions } from "lucide-react";

interface RadioScreenProps {
  channelA: string;
  channelB: string;
  onChannelAChange: (value: string) => void;
  onChannelBChange: (value: string) => void;
  activeChannel: "A" | "B";
  onActiveChannelChange: (channel: "A" | "B") => void;
  rssi: number;
  isTransmitting?: boolean;
  channelAName: string;
  channelBName: string;
  onChannelANameChange: (name: string) => void;
  onChannelBNameChange: (name: string) => void;
  myCallsign?: string;
  captionsEnabled?: boolean;
  onToggleCaptions?: () => void;
  partialCaption?: string;
  captionHistory?: string[];
  captionsSupported?: boolean;
}

const formatFreq = (value: string): { main: string } => {
  if (!value) return { main: "000.0000" };
  const parts = value.split(".");
  const integer = parts[0].padStart(3, "0");
  const decimal = (parts[1] || "").padEnd(4, "0").slice(0, 4);
  return { main: `${integer}.${decimal}` };
};

const ChannelNameEditor = ({
  name,
  onSave,
  tint,
}: {
  name: string;
  onSave: (v: string) => void;
  tint: "amber" | "green";
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  const tintColor = tint === "amber" ? "hsl(42 90% 58%)" : "hsl(140 70% 52%)";

  const open = () => {
    setDraft(name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commit = () => {
    onSave(draft.trim() || name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-3 pt-1 pb-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase().slice(0, 16))}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          className="font-mono-display text-[18px] font-semibold tracking-wider bg-transparent border-b outline-none w-full"
          style={{ color: tintColor, borderColor: `${tintColor}66` }}
        />
        <button onClick={commit} className="shrink-0" style={{ color: tintColor }}>
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={open}
      className="flex items-center gap-1 px-3 pt-1 pb-0 group"
    >
      <span
        className="font-mono-display text-[18px] font-semibold tracking-wider"
        style={{ color: `${tintColor}99` }}
      >
        {name}
      </span>
      <Pencil
        className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity"
        style={{ color: tintColor }}
      />
    </button>
  );
};


// Labels shown under specific bars only: S1, S3, S5, S7, S9, +60
const S_LABELS: Record<number, string> = { 0: "1", 2: "3", 4: "5", 6: "7", 8: "9", 9: "+60" };

const RSSIBar = ({ level }: { level: number }) => (
  <div className="flex items-end gap-[3px]">
    {Array.from({ length: 10 }).map((_, i) => {
      const isLit = i < level;
      const barColor = isLit
        ? i < 4
          ? "hsl(0 0% 75%)"
          : i < 7
          ? "hsl(45 80% 60%)"
          : "hsl(0 70% 55%)"
        : "hsl(0 0% 20%)";
      const labelColor = isLit
        ? i < 4
          ? "hsl(0 0% 75% / 0.7)"
          : i < 7
          ? "hsl(45 80% 60% / 0.7)"
          : "hsl(0 70% 55% / 0.7)"
        : "hsl(0 0% 30%)";
      const label = S_LABELS[i];
      const isLast = i === 9;

      return (
        <div key={i} className="flex flex-col items-center gap-[2px]">
          <div
            className="transition-all duration-100"
            style={{
              width: isLast ? "6px" : "4px",
              height: `${5 + Math.min(i, 8) * 1.6 + (isLast ? 1.5 : 0)}px`,
              borderRadius: "0.5px",
              background: barColor,
            }}
          />
          <span
            className="font-mono-display leading-none transition-all duration-100"
            style={{
              fontSize: "10px",
              color: label ? labelColor : "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {label ?? "1"}
          </span>
        </div>
      );
    })}
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
  channelName,
  onChannelNameChange,
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
  channelName: string;
  onChannelNameChange: (name: string) => void;
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

  return (
    <div
      className={`flex flex-col py-1 transition-all ${isActive ? "" : "opacity-60"}`}
      onClick={onClick}
    >
      {/* Channel memory name — tappable to edit */}
      <div onClick={(e) => e.stopPropagation()}>
        <ChannelNameEditor name={channelName} onSave={onChannelNameChange} tint={tint} />
      </div>

      {tags && tags.length > 0 && (
        <div className="flex items-center gap-3 mb-0.5 px-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="font-mono-display text-[11px] font-semibold tracking-wider text-white/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-0 pl-5 pr-3">
        <span
          className={`inline-flex h-[22px] w-[22px] items-center justify-center text-[12px] font-black mr-5 shrink-0 ${badgeColor}`}
          style={{
            boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.18), inset 0 -1px 0 hsl(0 0% 0% / 0.35), inset 1px 0 0 hsl(0 0% 100% / 0.08), inset -1px 0 0 hsl(0 0% 0% / 0.2)",
            transform: "translateY(-3px)",
          }}
        >
          {label}
        </span>
        <span
          className="font-freq-display text-[42px] leading-none transition-all duration-300 shrink-0"
          style={activeFreqStyle}
        >
          {freq.main}
        </span>
        {/* RSSI bar — centered in remaining space between freq and right bezel */}
        <div className="flex flex-1 items-end justify-center pb-[3px]">
          <RSSIBar level={rssi} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-0.5 px-3">
        <span className="font-mono-display text-[11px] font-semibold tracking-wider text-white/40">
          {modeLeft}
        </span>
        <span className="font-mono-display text-[11px] font-semibold tracking-wider text-white/40 pr-2">
          {modeRight}
        </span>
      </div>
    </div>
  );
};


/* ── Caption Panel — single row, types letter-by-letter ── */
const CaptionPanel = ({
  history,
  partial,
}: {
  history: string[];
  partial: string;
}) => {
  const CHARS_PER_ROW = 34;
  // The "target" is the full string we want to display
  const targetText = [...history, partial].filter(Boolean).join(" ").trim();

  // displayText animates toward targetText one character at a time
  const [displayText, setDisplayText] = useState("");
  const targetRef = useRef(targetText);
  targetRef.current = targetText;

  useEffect(() => {
    // If target shrank (e.g. CC was reset), snap immediately
    if (targetText.length < displayText.length) {
      setDisplayText(targetText);
      return;
    }

    if (displayText === targetText) return;

    // Type the next character after a short delay
    const timer = setTimeout(() => {
      setDisplayText(targetRef.current.slice(0, displayText.length + 1));
    }, 28); // ~36 chars/sec — fast but clearly animated

    return () => clearTimeout(timer);
  }, [displayText, targetText]);

  // Show only the last CHARS_PER_ROW characters
  const display = displayText.length > CHARS_PER_ROW
    ? displayText.slice(displayText.length - CHARS_PER_ROW)
    : displayText;

  const isEmpty = !displayText;

  return (
    <div
      className="mx-2 mb-1 rounded-lg overflow-hidden animate-fade-in"
      style={{
        background: "hsl(220 40% 4%)",
        border: "1px solid hsl(140 30% 14% / 0.7)",
        boxShadow: "inset 0 3px 12px hsl(220 60% 2% / 0.9)",
        position: "relative",
        height: "38px",
      }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-10 rounded-lg"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(0 0% 0% / 0.08) 3px, hsl(0 0% 0% / 0.08) 6px)",
        }}
      />

      <div className="relative z-10 h-full flex items-center px-3">
        {isEmpty ? (
          <span
            className="font-mono-display text-[13px] italic"
            style={{ color: "hsl(140 35% 25%)" }}
          >
            Listening…
          </span>
        ) : (
          <span
            className="font-mono-display text-[17px] font-semibold"
            style={{
              color: "hsl(0 0% 95%)",
              whiteSpace: "pre",
              letterSpacing: "0.01em",
            }}
          >
            {display}
          </span>
        )}
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
  isTransmitting = false,
  channelAName,
  channelBName,
  onChannelANameChange,
  onChannelBNameChange,
  myCallsign = "",
  captionsEnabled = false,
  onToggleCaptions,
  partialCaption = "",
  captionHistory = [],
  captionsSupported = true,
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
      className="w-full rounded-[18px] py-[6px] px-0 relative"
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
          background: "linear-gradient(180deg, hsl(220 8% 13%) 0%, hsl(220 6% 10%) 100%)",
          /*
           * All four chassis edges protrude forward of the screen.
           * All borders are dark — no light catching on any edge.
           * All shadows are inset only — nothing leaks outside the LCD boundary.
           */
          borderTop: "2px solid hsl(220 18% 5%)",
          borderLeft: "1.5px solid hsl(220 15% 6%)",
          borderRight: "1.5px solid hsl(220 15% 6%)",
          borderBottom: "2px solid hsl(220 18% 5%)",
          boxShadow:
            /* Top chassis lip — heaviest inset shadow */
            "inset 0 10px 24px hsl(220 60% 1% / 0.98), " +
            "inset 0 5px 12px hsl(220 50% 2% / 0.85), " +
            "inset 0 2px 5px hsl(220 40% 3% / 0.6), " +
            /* Bottom chassis lip — matching inset shadow */
            "inset 0 -10px 24px hsl(220 60% 1% / 0.98), " +
            "inset 0 -5px 12px hsl(220 50% 2% / 0.85), " +
            /* Side wall inset shadows */
            "inset 7px 0 16px hsl(220 50% 2% / 0.6), " +
            "inset -7px 0 16px hsl(220 50% 2% / 0.6), " +
            /* Ambient screen fill */
            "inset 0 0 40px hsl(218 60% 8% / 0.4), " +
            /* Outer: hard dark shadow above the LCD only — chassis overhang */
            "0 -3px 6px hsl(220 25% 2% / 0.95)",
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
              "radial-gradient(ellipse at 50% 40%, hsl(140 70% 45% / 0.05) 0%, hsl(140 60% 40% / 0.02) 50%, transparent 70%)",
            boxShadow:
              !isTransmitting && animatedRssi > 3
                ? "inset 0 0 16px hsl(140 70% 45% / 0.03)"
                : "none",
          }}
        />
        {/* TX red bloom — glows when transmitting */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl transition-opacity duration-150"
          style={{
            opacity: isTransmitting ? 1 : 0,
            background:
              "radial-gradient(ellipse at 50% 40%, hsl(var(--transmit) / 0.05) 0%, hsl(var(--transmit) / 0.02) 50%, transparent 70%)",
            boxShadow: isTransmitting
              ? "inset 0 0 16px hsl(var(--transmit) / 0.03)"
              : "none",
          }}
        />
        {/* Top status icons */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/[0.06]">
          <Zap className="h-4 w-4 text-red-400/70" />
          <span className="font-mono-display text-[12px] font-bold text-white/40">Z</span>
          <Music className="h-4 w-4 text-white/30" />
          <Bluetooth className="h-4 w-4 text-white/30" />
          {/* Callsign — centered in the status bar */}
          <div className="flex-1 flex justify-center">
            {myCallsign ? (
              <span
                className="font-mono-display text-[16px] font-black tracking-[0.18em]"
                style={{
                  color: "hsl(0 0% 98%)",
                  textShadow:
                    "0 0 4px hsl(200 80% 90% / 0.5), 0 0 12px hsl(200 70% 80% / 0.25)",
                }}
              >
                {myCallsign}
              </span>
            ) : (
              <span className="font-mono-display text-[11px] tracking-wider text-white/15">
                NO CALL
              </span>
            )}
          </div>
          {/* RX indicator */}
          <span
            className="font-mono-display text-[13px] font-black tracking-widest transition-all duration-100"
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
            className="font-mono-display text-[13px] font-black tracking-widest transition-all duration-100"
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
          <Battery className="h-4 w-4 text-signal" />
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
          channelName={channelAName}
          onChannelNameChange={onChannelANameChange}
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
          channelName={channelBName}
          onChannelNameChange={onChannelBNameChange}
          onClick={() => onActiveChannelChange("B")}
        />


        {/* Caption panel — shown when CC is active */}
        {captionsEnabled && (
          <CaptionPanel history={captionHistory} partial={partialCaption} />
        )}

        {/* Bottom bar */}
        <div className="flex items-center px-3 py-1.5 border-t border-white/[0.06]">
          {["VOX", "APRS", "MO", "TW"].map((tag, i) => (
            <span
              key={tag}
              className={`font-mono-display text-[11px] font-bold tracking-[0.12em] mr-4 ${
                i === 0 ? "text-white/60" : "text-white/25"
              }`}
            >
              {tag}
            </span>
          ))}
          <div className="flex-1" />
          {/* CC toggle button — prominent, labelled */}
          {captionsSupported && (
            <button
              onClick={onToggleCaptions}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-all duration-150 mr-1"
              style={
                captionsEnabled
                  ? {
                      background: "hsl(140 60% 18% / 0.7)",
                      border: "1px solid hsl(140 60% 35% / 0.6)",
                      boxShadow: "0 0 8px hsl(140 70% 45% / 0.25)",
                    }
                  : {
                      background: "hsl(220 15% 12%)",
                      border: "1px solid hsl(220 10% 22%)",
                    }
              }
              title="Toggle Closed Captions"
              aria-label="Toggle closed captions"
            >
              <Captions
                className="h-4 w-4"
                style={
                  captionsEnabled
                    ? { color: "hsl(140 70% 52%)", filter: "drop-shadow(0 0 3px hsl(140 70% 52% / 0.7))" }
                    : { color: "hsl(0 0% 40%)" }
                }
              />
              <span
                className="font-mono-display text-[11px] font-bold tracking-wider"
                style={
                  captionsEnabled
                    ? { color: "hsl(140 70% 52%)", textShadow: "0 0 6px hsl(140 70% 52% / 0.7)" }
                    : { color: "hsl(0 0% 40%)" }
                }
              >
                CC
              </span>
              {captionsEnabled && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "hsl(140 70% 52%)", boxShadow: "0 0 4px hsl(140 70% 52%)" }}
                />
              )}
            </button>
          )}
          <span className="font-mono-display text-[11px] text-white/25">🔒</span>
        </div>
      </div>
    </div>
  );
};

export default RadioScreen;
