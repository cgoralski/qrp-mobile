import { useState, useCallback, useRef } from "react";
import { Radio, BookUser, Radio as RadioIcon, Map } from "lucide-react";
import type { TabId } from "@/components/BottomTabBar";
import RadioScreen from "@/components/RadioScreen";
import NumPad from "@/components/NumPad";
import DPad from "@/components/DPad";
import ConnectionStatus from "@/components/ConnectionStatus";
import BottomTabBar from "@/components/BottomTabBar";
import APRSMessaging from "@/components/APRSMessaging";
import ContactsScreen from "@/components/ContactsScreen";
import SettingsScreen from "@/components/SettingsScreen";
import { useCaptions } from "@/hooks/use-captions";

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
    width: "10px",
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
        className="font-mono-display text-[5px] tracking-wider"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          color: accent ? "hsl(185 70% 65%)" : "hsl(0 0% 35%)",
          overflow: "hidden",
          maxHeight: "28px",
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




/* ── Speaker grille dots ── */
const SpeakerGrille = () => (
  <div
    className="w-full grid gap-[3px] px-3 py-1.5"
    style={{ gridTemplateColumns: "repeat(12, 1fr)" }}
  >
    {Array.from({ length: 36 }).map((_, i) => (
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

const TAB_ORDER: TabId[] = ["voice", "aprs", "contacts", "scanner", "map", "settings"];

const Index = () => {
  const [channelA, setChannelA] = useState("027.00000");
  const [channelB, setChannelB] = useState("435.00000");
  const [activeChannel, setActiveChannel] = useState<"A" | "B">("A");
  const [inputBuffer, setInputBuffer] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("voice");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [channelAName, setChannelAName] = useState("REPEATER 1");
  const [channelBName, setChannelBName] = useState("CALLING CH");
  const [myCallsign, setMyCallsign] = useState<string>(
    () => localStorage.getItem("myCallsign") ?? ""
  );

  const captions = useCaptions();

  const handleCallsignChange = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 10);
    setMyCallsign(upper);
    localStorage.setItem("myCallsign", upper);
  };

  const swipeTouchStartX = useRef<number | null>(null);
  const swipeTouchStartY = useRef<number | null>(null);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || swipeTouchStartY.current === null) return;
    const dx = swipeTouchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(swipeTouchStartY.current - e.changedTouches[0].clientY);
    // Only trigger if horizontal movement dominates and is > 50px
    if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (dx > 0 && currentIndex < TAB_ORDER.length - 1) {
        setActiveTab(TAB_ORDER[currentIndex + 1]); // swipe left → next
      } else if (dx < 0 && currentIndex > 0) {
        setActiveTab(TAB_ORDER[currentIndex - 1]); // swipe right → prev
      }
    }
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
  };

  const setActiveFreq = activeChannel === "A" ? setChannelA : setChannelB;

  const handleDigit = useCallback(
    (digit: string) => {
      if (digit === "*" || digit === "#") return;
      // Strip existing decimal for counting raw digits
      const rawDigits = inputBuffer.replace(".", "");
      const hasDot = inputBuffer.includes(".");
      const intPart = hasDot ? inputBuffer.split(".")[0] : inputBuffer;
      const decPart = hasDot ? inputBuffer.split(".")[1] ?? "" : null;

      // Allow up to 3 integer digits, then up to 4 decimal digits
      if (!hasDot && rawDigits.length >= 3) return; // integer full, need decimal first
      if (hasDot && (decPart?.length ?? 0) >= 4) return; // decimal full

      const next = inputBuffer + digit;
      setInputBuffer(next);
      // Format: insert dot after 3 integer digits
      const stripped = next.replace(".", "");
      const raw = stripped.length > 3
        ? stripped.slice(0, 3) + "." + stripped.slice(3)
        : stripped;
      setActiveFreq(raw);
    },
    [inputBuffer, setActiveFreq]
  );

  const handleDecimal = useCallback(() => {
    if (inputBuffer.includes(".")) return; // already has a dot
    // Pad integer part to 3 digits before inserting dot
    const padded = inputBuffer.padStart(3, "0");
    const next = padded + ".";
    setInputBuffer(next);
    setActiveFreq(next);
  }, [inputBuffer, setActiveFreq]);

  const handleBackspace = useCallback(() => {
    const next = inputBuffer.slice(0, -1);
    setInputBuffer(next);
    if (next.length === 0) {
      setActiveFreq("000.0000");
    } else {
      const stripped = next.replace(".", "");
      const raw = stripped.length > 3
        ? stripped.slice(0, 3) + "." + stripped.slice(3)
        : stripped;
      setActiveFreq(raw);
    }
  }, [inputBuffer, setActiveFreq]);

  const handleEnter = useCallback(() => {
    setInputBuffer("");
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mesh">
      {/* App header */}
      <header className="glass-header sticky top-0 z-50 flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono-display text-sm font-semibold tracking-wider text-foreground">
            QRP<span className="text-primary text-glow">MOBILE</span>
          </span>
        </div>

        <ConnectionStatus connected={false} />
      </header>

      {/* ── Radio body shell ── */}
      <main
        className="flex flex-1 flex-col items-center justify-start px-0 py-1 max-w-[480px] mx-auto w-full overflow-hidden"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
      >
        {activeTab === "voice" ? (
          <div className="w-full relative animate-fade-in">
          {/* SVG clipPath definition — tapered sides + rounded bottom corners */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <clipPath id="chassisClip" clipPathUnits="objectBoundingBox">
                {/*
                  Tapered shape: full-width at top, curves inward ~35–50% down,
                  then rounded bottom corners (Q bezier, radius ≈ 0.05).
                */}
                <path d="M 0,0 L 1,0 L 1,0.32 L 0.97,0.40 L 0.94,0.50 L 0.93,0.95 Q 0.93,1 0.88,1 L 0.12,1 Q 0.07,1 0.07,0.95 L 0.06,0.50 L 0.03,0.40 L 0,0.32 Z" />
              </clipPath>
            </defs>
          </svg>
          <div
            className="w-full flex relative"
            style={{
              background:
                "linear-gradient(175deg, hsl(220 12% 16%) 0%, hsl(220 10% 11%) 60%, hsl(220 8% 8%) 100%)",
              border: "1px solid hsl(220 10% 22%)",
              boxShadow:
                "inset 0 1px 0 hsl(0 0% 45% / 0.18), inset 0 -2px 0 hsl(0 0% 0% / 0.6), 0 20px 60px hsl(220 30% 2% / 0.95), 0 8px 24px hsl(220 20% 2% / 0.7)",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E\"), linear-gradient(175deg, hsl(220 12% 16%) 0%, hsl(220 10% 11%) 60%, hsl(220 8% 8%) 100%)",
              backgroundBlendMode: "overlay, normal",
              clipPath: "url(#chassisClip)",
            }}
          >
            <div className="flex flex-col items-end" style={{ width: "20px" }}>
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

              {/* Side buttons */}
              <div className="flex flex-col gap-1.5 pt-2">
                <SideButton label="VOL" top accent />
                <SideButton label="MON" />
              </div>
            </div>

            {/* ── Main body column ── */}
            <div className="flex flex-1 flex-col px-0 pb-2 gap-1 min-w-0">
              {/* Top sheen */}
              <div
                className="absolute inset-x-12 pointer-events-none h-[1px] rounded-full"
                style={{
                  top: "1px",
                  background: "linear-gradient(90deg, transparent, hsl(0 0% 65% / 0.14), transparent)",
                }}
              />

              {/* Radio screen */}
              <div className="pt-1">
              <RadioScreen
                  channelA={channelA}
                  channelB={channelB}
                  onChannelAChange={setChannelA}
                  onChannelBChange={setChannelB}
                  activeChannel={activeChannel}
                  onActiveChannelChange={setActiveChannel}
                  rssi={5}
                  isTransmitting={isTransmitting}
                  channelAName={channelAName}
                  channelBName={channelBName}
                  onChannelANameChange={setChannelAName}
                  onChannelBNameChange={setChannelBName}
                  myCallsign={myCallsign}
                  captionsEnabled={captions.isActive}
                  onToggleCaptions={captions.toggle}
                  partialCaption={captions.partialText}
                  captionHistory={captions.captionHistory}
                  captionsSupported={captions.isSupported}
                />
              </div>

              {/* D-pad navigation cluster */}
              <DPad />

              {/* Keypad */}
              <div className="px-10">
                <NumPad
                  onDigit={handleDigit}
                  onDecimal={handleDecimal}
                  onBackspace={handleBackspace}
                  onEnter={handleEnter}
                />
              </div>

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
              style={{ width: "20px", transform: "scaleX(-1)" }}
            >
              <SideButton label="SQL" top />
              <SideButton label="SCAN" accent />
              <SideButton label="CH" />
              <SideButton label="PWR" />
            </div>
            </div>
            {/* ── Left taper bevel — starts at MENU button level ── */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "52%",
                bottom: "3%",
                width: "10%",
                background:
                  "linear-gradient(to right, " +
                  "rgba(0,0,0,0) 0%, " +
                  "rgba(0,0,0,0.18) 18%, " +
                  "rgba(210,210,210,0.82) 28%, " +
                  "rgba(255,255,255,0.28) 34%, " +
                  "rgba(0,0,0,0.45) 42%, " +
                  "rgba(0,0,0,0) 65%)",
                pointerEvents: "none",
                zIndex: 50,
              }}
            />
            {/* ── Right taper bevel — mirror of left ── */}
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "52%",
                bottom: "3%",
                width: "10%",
                background:
                  "linear-gradient(to left, " +
                  "rgba(0,0,0,0) 0%, " +
                  "rgba(0,0,0,0.18) 18%, " +
                  "rgba(210,210,210,0.82) 28%, " +
                  "rgba(255,255,255,0.28) 34%, " +
                  "rgba(0,0,0,0.45) 42%, " +
                  "rgba(0,0,0,0) 65%)",
                pointerEvents: "none",
                zIndex: 50,
              }}
            />
          </div>
        ) : activeTab === "aprs" ? (
          <APRSMessaging myCallsign={myCallsign} onNavigateToSettings={() => setActiveTab("settings")} />
        ) : activeTab === "contacts" ? (
          <div className="flex flex-1 flex-col w-full px-1 py-1 min-h-0">
            <ContactsScreen
              onTuneChannel={(freq) => {
                if (activeChannel === "A") setChannelA(freq);
                else setChannelB(freq);
              }}
              activeChannel={activeChannel}
            />
          </div>
        ) : activeTab === "scanner" ? (
          <div className="flex flex-1 flex-col w-full px-1 py-1 min-h-0">
            <div className="tab-panel flex flex-1 flex-col w-full animate-fade-in">
              <div className="tab-header flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <RadioIcon className="h-4 w-4 text-primary" />
                  <span className="tab-section-title">SCANNER</span>
                </div>
                <span className="tab-meta">FREQUENCY SCAN</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-6">
                <RadioIcon className="h-8 w-8 opacity-20 text-primary" />
                <span className="tab-section-title opacity-50">COMING SOON</span>
                <span className="tab-meta opacity-40 text-center leading-relaxed">
                  Frequency scanner will step through repeaters from the database filtered by country or band.
                </span>
              </div>
            </div>
          </div>
        ) : activeTab === "map" ? (
          <div className="flex flex-1 flex-col w-full px-1 py-1 min-h-0">
            <div className="tab-panel flex flex-1 flex-col w-full animate-fade-in">
              <div className="tab-header flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  <span className="tab-section-title">MAP</span>
                </div>
                <span className="tab-meta">REPEATER MAP</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-6">
                <Map className="h-8 w-8 opacity-20 text-primary" />
                <span className="tab-section-title opacity-50">COMING SOON</span>
                <span className="tab-meta opacity-40 text-center leading-relaxed">
                  Interactive map showing repeater locations with pins for each country.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col w-full px-1 py-1 min-h-0">
            <SettingsScreen myCallsign={myCallsign} onCallsignChange={handleCallsignChange} />
          </div>
        )}
      </main>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
