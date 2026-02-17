import { useState, useCallback } from "react";
import { Radio, Settings } from "lucide-react";
import RadioScreen from "@/components/RadioScreen";
import NumPad from "@/components/NumPad";
import DPad from "@/components/DPad";
import ConnectionStatus from "@/components/ConnectionStatus";
import BottomTabBar from "@/components/BottomTabBar";
import APRSMessaging from "@/components/APRSMessaging";

/* ── Decorative side button used on the radio body ── */
const SideButton = ({
  label,
  top,
  accent,
}: {
  label: string;
  top?: boolean;
  accent?: boolean;
}) => (
  <div
    className="relative flex items-center justify-center cursor-pointer select-none"
    style={{
      width: "14px",
      height: top ? "44px" : "32px",
      borderRadius: "3px 0 0 3px",
      background: accent
        ? "linear-gradient(180deg, hsl(185 70% 30%), hsl(185 60% 20%))"
        : "linear-gradient(180deg, hsl(220 12% 22%), hsl(220 10% 14%))",
      border: "1px solid hsl(220 10% 28%)",
      borderRight: "none",
      boxShadow:
        "inset 0 1px 0 hsl(0 0% 50% / 0.15), inset 0 -1px 0 hsl(0 0% 0% / 0.4), -3px 2px 6px hsl(220 30% 2% / 0.6)",
    }}
  >
    <span
      className="font-mono-display text-[6px] tracking-wider"
      style={{
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        transform: "rotate(180deg)",
        color: accent ? "hsl(185 70% 65%)" : "hsl(0 0% 35%)",
      }}
    >
      {label}
    </span>
    {/* Grip ridge */}
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="absolute"
        style={{
          left: "3px",
          top: `${30 + i * 5}%`,
          width: "5px",
          height: "1px",
          borderRadius: "1px",
          background: "hsl(0 0% 0% / 0.3)",
        }}
      />
    ))}
  </div>
);

/* ── PTT side button (large left-side, like real radio) ── */
const PttSideButton = () => {
  const [isPressed, setIsPressed] = useState(false);
  return (
    <div className="flex flex-col items-center w-full mt-1 mb-1">
      {/* TX LED */}
      <div
        className="rounded-full mb-1 transition-all duration-150"
        style={{
          width: "5px",
          height: "5px",
          background: isPressed ? "hsl(var(--transmit))" : "hsl(0 0% 12%)",
          boxShadow: isPressed
            ? "0 0 6px hsl(var(--transmit) / 0.9), 0 0 14px hsl(var(--transmit) / 0.4)"
            : "inset 0 1px 2px hsl(0 0% 0% / 0.6)",
          border: "1px solid hsl(0 0% 8%)",
        }}
      />
      {/* PTT button body */}
      <button
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        onTouchCancel={() => setIsPressed(false)}
        aria-label="Push to talk"
        className="select-none transition-all duration-100"
        style={{
          width: "22px",
          height: "72px",
          borderRadius: "4px 0 0 4px",
          background: isPressed
            ? "linear-gradient(180deg, hsl(var(--transmit) / 0.95), hsl(0 75% 38%))"
            : "linear-gradient(180deg, hsl(130 50% 30%), hsl(130 45% 18%))",
          border: "1px solid hsl(130 40% 22%)",
          borderRight: "none",
          boxShadow: isPressed
            ? "inset 0 2px 6px hsl(0 0% 0% / 0.5), 0 0 16px hsl(var(--transmit) / 0.4)"
            : "inset 0 1px 0 hsl(0 0% 50% / 0.15), inset 0 -1px 0 hsl(0 0% 0% / 0.5), -3px 2px 8px hsl(220 30% 2% / 0.7)",
          transform: isPressed ? "scaleX(0.93)" : "scaleX(1)",
        }}
      >
        {/* Grip ridges */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: "3px",
              right: "3px",
              top: `${20 + i * 14}%`,
              height: "1px",
              borderRadius: "1px",
              background: isPressed
                ? "hsl(0 0% 100% / 0.2)"
                : "hsl(0 0% 0% / 0.3)",
            }}
          />
        ))}
      </button>
      {/* PTT label */}
      <span
        className="font-mono-display mt-1 transition-colors duration-150"
        style={{
          fontSize: "5px",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          letterSpacing: "0.15em",
          color: isPressed ? "hsl(var(--transmit))" : "hsl(0 0% 30%)",
        }}
      >
        PTT
      </span>
    </div>
  );
};

/* ── Speaker grille dots ── */
const SpeakerGrille = () => (
  <div
    className="w-full grid gap-[3px] px-3 py-2"
    style={{ gridTemplateColumns: "repeat(12, 1fr)" }}
  >
    {Array.from({ length: 48 }).map((_, i) => (
      <div
        key={i}
        className="rounded-full"
        style={{
          width: "4px",
          height: "4px",
          background: "hsl(220 15% 10%)",
          boxShadow: "inset 0 1px 1px hsl(0 0% 0% / 0.8), 0 0.5px 0 hsl(0 0% 20% / 0.2)",
        }}
      />
    ))}
  </div>
);

const Index = () => {
  const [channelA, setChannelA] = useState("027.00000");
  const [channelB, setChannelB] = useState("435.00000");
  const [activeChannel, setActiveChannel] = useState<"A" | "B">("A");
  const [inputBuffer, setInputBuffer] = useState("");
  const [activeTab, setActiveTab] = useState<"voice" | "aprs" | "settings">("voice");

  const setActiveFreq = activeChannel === "A" ? setChannelA : setChannelB;

  const handleDigit = useCallback(
    (digit: string) => {
      if (digit === "*" || digit === "#") return;
      const next = inputBuffer + digit;
      if (next.length <= 8) {
        setInputBuffer(next);
        const raw = next.length > 3 ? next.slice(0, 3) + "." + next.slice(3) : next;
        setActiveFreq(raw);
      }
    },
    [inputBuffer, setActiveFreq]
  );

  const handleBackspace = useCallback(() => {
    const next = inputBuffer.slice(0, -1);
    setInputBuffer(next);
    if (next.length === 0) {
      setActiveFreq("000.00000");
    } else {
      const raw = next.length > 3 ? next.slice(0, 3) + "." + next.slice(3) : next;
      setActiveFreq(raw);
    }
  }, [inputBuffer, setActiveFreq]);

  const handleEnter = useCallback(() => {
    setInputBuffer("");
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mesh">
      {/* App header */}
      <header className="glass-header sticky top-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono-display text-sm font-semibold tracking-wider text-foreground">
            RADIO<span className="text-primary text-glow">LINK</span>
          </span>
        </div>
        <ConnectionStatus connected={false} />
      </header>

      {/* ── Radio body shell ── */}
      <main className="flex flex-1 flex-col items-center justify-start px-0 py-3 max-w-sm mx-auto w-full">
        {activeTab === "voice" ? (
          /* Outer radio chassis */
          <div
            className="w-full flex animate-fade-in relative"
            style={{
              background:
                "linear-gradient(175deg, hsl(220 12% 16%) 0%, hsl(220 10% 11%) 60%, hsl(220 8% 8%) 100%)",
              border: "1px solid hsl(220 10% 22%)",
              borderRadius: "20px 20px 16px 16px",
              boxShadow:
                "inset 0 1px 0 hsl(0 0% 45% / 0.18), inset 0 -2px 0 hsl(0 0% 0% / 0.6), 0 20px 60px hsl(220 30% 2% / 0.95), 0 8px 24px hsl(220 20% 2% / 0.7)",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E\"), linear-gradient(175deg, hsl(220 12% 16%) 0%, hsl(220 10% 11%) 60%, hsl(220 8% 8%) 100%)",
              backgroundBlendMode: "overlay, normal",
            }}
          >
            {/* ── Left side: PTT + side buttons ── */}
            <div className="flex flex-col items-end" style={{ width: "28px" }}>
              {/* Antenna stub at top-left */}
              <div className="flex justify-center w-full pt-2 pb-1">
                <div
                  style={{
                    width: "7px",
                    height: "28px",
                    borderRadius: "3px 3px 2px 2px",
                    background: "linear-gradient(180deg, hsl(220 10% 28%) 0%, hsl(220 8% 18%) 100%)",
                    border: "1px solid hsl(220 8% 32%)",
                    boxShadow: "inset 0 1px 0 hsl(0 0% 40% / 0.2)",
                  }}
                />
              </div>

              {/* PTT button — large prominent left-side button */}
              <PttSideButton />

              {/* Lower side buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <SideButton label="VOL" top accent />
                <SideButton label="MON" />
              </div>
            </div>

            {/* ── Main body column ── */}
            <div className="flex flex-1 flex-col px-2 pb-3 gap-2 min-w-0">
              {/* Top sheen */}
              <div
                className="absolute inset-x-12 pointer-events-none h-[1px] rounded-full"
                style={{
                  top: "1px",
                  background: "linear-gradient(90deg, transparent, hsl(0 0% 65% / 0.14), transparent)",
                }}
              />

              {/* Radio screen */}
              <div className="pt-2">
                <RadioScreen
                  channelA={channelA}
                  channelB={channelB}
                  onChannelAChange={setChannelA}
                  onChannelBChange={setChannelB}
                  activeChannel={activeChannel}
                  onActiveChannelChange={setActiveChannel}
                  rssi={5}
                />
              </div>

              {/* D-pad navigation cluster */}
              <DPad />

              {/* Keypad */}
              <NumPad
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onEnter={handleEnter}
              />

              {/* ── Speaker grille ── */}
              <div
                className="rounded-xl overflow-hidden mt-1"
                style={{
                  background: "hsl(220 12% 8%)",
                  border: "1px solid hsl(220 10% 14%)",
                  boxShadow: "inset 0 2px 6px hsl(220 30% 2% / 0.7)",
                }}
              >
                <SpeakerGrille />
              </div>
            </div>

            {/* ── Right side buttons ── */}
            <div
              className="flex flex-col items-start pt-10 gap-2 pr-0"
              style={{ width: "28px", transform: "scaleX(-1)" }}
            >
              <SideButton label="SQL" top />
              <SideButton label="SCAN" accent />
              <SideButton label="CH" />
              <SideButton label="PWR" />
            </div>
          </div>
        ) : activeTab === "aprs" ? (
          <APRSMessaging />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3">
            <Settings className="h-8 w-8 opacity-30" />
            <span className="font-mono-display text-xs tracking-wider">SETTINGS</span>
            <span className="text-[11px] text-muted-foreground/60">Coming soon</span>
          </div>
        )}
      </main>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
