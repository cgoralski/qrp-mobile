import { useState, useCallback, useRef, useEffect } from "react";
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

/* ── Header Caption Panel — inline live CC text for the top bar ── */
const HeaderCaptionPanel = ({
  history,
  partial,
}: {
  history: string[];
  partial: string;
}) => {
  const targetText = [...history, partial].filter(Boolean).join(" ").trim();
  const [displayText, setDisplayText] = useState("");
  const targetRef = useRef(targetText);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  targetRef.current = targetText;

  useEffect(() => {
    if (targetText.length < displayText.length) { setDisplayText(targetText); return; }
    if (displayText === targetText) return;
    const timer = setTimeout(() => {
      setDisplayText(targetRef.current.slice(0, displayText.length + 1));
    }, 28);
    return () => clearTimeout(timer);
  }, [displayText, targetText]);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;
    const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth;
    textRef.current.style.transform = overflow > 0 ? `translateX(-${overflow}px)` : "translateX(0)";
  }, [displayText]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      {!displayText ? (
        <span className="font-mono-display text-[15px] italic" style={{ color: "hsl(0 0% 97%)" }}>
          Listening…
        </span>
      ) : (
        <span
          ref={textRef}
          className="font-mono-display text-[19px] font-semibold"
          style={{
            color: "hsl(0 0% 97%)",
            whiteSpace: "nowrap",
            letterSpacing: "0.01em",
            display: "inline-block",
            transformOrigin: "left center",
            textShadow: "0 0 8px hsl(0 0% 100% / 0.3)",
          }}
        >
          {displayText}
        </span>
      )}
    </div>
  );
};

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
  // Track live swipe offset for real-time drag feedback
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const captions = useCaptions();

  // Reset any browser-induced scroll offset whenever the tab changes.
  // On mobile, opening a keyboard in APRS chat can push window.scrollY up;
  // this snaps it back immediately when switching tabs.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  const handleCallsignChange = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 10);
    setMyCallsign(upper);
    localStorage.setItem("myCallsign", upper);
  };

  const swipeTouchStartX = useRef<number | null>(null);
  const swipeTouchStartY = useRef<number | null>(null);
  const swipeLockedAxis = useRef<"h" | "v" | null>(null);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
    swipeLockedAxis.current = null;
    setSwipeDelta(0);
  };

  const handleSwipeTouchMove = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || swipeTouchStartY.current === null) return;
    const dx = e.touches[0].clientX - swipeTouchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeTouchStartY.current);

    // Lock axis on first significant movement
    if (swipeLockedAxis.current === null && (Math.abs(dx) > 8 || dy > 8)) {
      swipeLockedAxis.current = Math.abs(dx) > dy ? "h" : "v";
    }

    if (swipeLockedAxis.current === "h") {
      e.preventDefault();
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      // Resist at edges
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === TAB_ORDER.length - 1 && dx < 0;
      const resistance = atStart || atEnd ? 0.2 : 1;
      setSwipeDelta(dx * resistance);
      setIsSwiping(true);
    }
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || swipeTouchStartY.current === null) return;
    const dx = swipeTouchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(swipeTouchStartY.current - e.changedTouches[0].clientY);

    setSwipeDelta(0);
    setIsSwiping(false);

    if (swipeLockedAxis.current === "h" && Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (dx > 0 && currentIndex < TAB_ORDER.length - 1) {
        setActiveTab(TAB_ORDER[currentIndex + 1]);
      } else if (dx < 0 && currentIndex > 0) {
        setActiveTab(TAB_ORDER[currentIndex - 1]);
      }
    }
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
    swipeLockedAxis.current = null;
  };

  const setActiveFreq = activeChannel === "A" ? setChannelA : setChannelB;

  const handleDigit = useCallback(
    (digit: string) => {
      if (digit === "*" || digit === "#") return;

      const hasDot = inputBuffer.includes(".");
      const decPart = hasDot ? inputBuffer.split(".")[1] ?? "" : "";
      const intPart = hasDot ? inputBuffer.split(".")[0] : inputBuffer;

      // Decimal digits cap at 4
      if (hasDot && decPart.length >= 4) return;
      // Integer digits cap at 3 — but instead of blocking, auto-insert the dot
      if (!hasDot && intPart.length >= 3) {
        // Auto-insert decimal and start decimal part with this digit
        const withDot = intPart + "." + digit;
        setInputBuffer(withDot);
        setActiveFreq(withDot);
        return;
      }

      const next = inputBuffer + digit;
      setInputBuffer(next);
      setActiveFreq(next);
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

  const stepFrequency = useCallback((direction: 1 | -1) => {
    const current = activeChannel === "A" ? channelA : channelB;
    const parsed = parseFloat(current);
    if (isNaN(parsed)) return;
    const stepped = Math.max(0, parsed + direction * 0.5);
    const formatted = stepped.toFixed(4).replace(/^(\d{1,3})/, (m) => m.padStart(3, "0"));
    setInputBuffer("");
    if (activeChannel === "A") setChannelA(formatted);
    else setChannelB(formatted);
  }, [activeChannel, channelA, channelB]);

  return (
    <div className="flex h-[100dvh] flex-col bg-mesh overflow-hidden">
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
        className="flex flex-1 flex-col max-w-[480px] mx-auto w-full"
        onTouchStart={handleSwipeTouchStart}
        onTouchMove={handleSwipeTouchMove}
        onTouchEnd={handleSwipeTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        {/* Overflow clip wrapper — strips must NOT overflow this */}
        <div className="flex-1 overflow-hidden relative min-h-0">
        {/* Sliding strip — all tabs laid out horizontally */}
        <div
          className="flex h-full"
          style={{
            width: `${TAB_ORDER.length * 100}%`,
            transform: `translateX(calc(${-TAB_ORDER.indexOf(activeTab) * (100 / TAB_ORDER.length)}% + ${swipeDelta}px))`,
            transition: isSwiping ? "none" : "transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            willChange: "transform",
          }}
        >
          {/* ── Voice tab ── */}
          <div className="flex flex-col items-center justify-start py-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <div className="w-full relative">
            {/* SVG clipPath definition — tapered sides + rounded bottom corners */}
            <svg width="0" height="0" style={{ position: "absolute" }}>
              <defs>
                <clipPath id="chassisClip" clipPathUnits="objectBoundingBox">
                  {/*
                    Tapered shape: full-width at top, gentle inward bend just below LCD (~44–58%),
                    only ~3% narrowing each side, then rounded bottom corners.
                  */}
                  <path d="M 0,0 L 1,0 L 1,0.44 L 0.985,0.52 L 0.97,0.58 L 0.965,0.95 Q 0.965,1 0.915,1 L 0.085,1 Q 0.035,1 0.035,0.95 L 0.03,0.58 L 0.015,0.52 L 0,0.44 Z" />
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
                <div className="flex flex-col gap-1.5 pt-2">
                  <SideButton label="VOL" top accent />
                  <SideButton label="MON" />
                </div>
              </div>

              <div className="flex flex-1 flex-col px-0 pb-2 gap-1 min-w-0">
                <div
                  className="absolute inset-x-12 pointer-events-none h-[1px] rounded-full"
                  style={{
                    top: "1px",
                    background: "linear-gradient(90deg, transparent, hsl(0 0% 65% / 0.14), transparent)",
                  }}
                />
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
                {captions.isActive && (
                  <div className="w-full px-3 py-1">
                    <div
                      className="w-full overflow-hidden px-4 py-2"
                      style={{
                        background: "hsl(220 15% 30% / 0.45)",
                        backdropFilter: "blur(20px) saturate(1.6)",
                        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                        borderRadius: "9999px",
                        border: "1px solid hsl(0 0% 100% / 0.12)",
                        boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.1), 0 4px 12px hsl(220 30% 2% / 0.3)",
                      }}
                    >
                      {/* Listening indicator dot */}
                      <div className="flex items-center gap-2.5 w-full">
                        <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: "16px", height: "16px" }}>
                          {/* Pulse ring — only when actively listening */}
                          {captions.isListening && (
                            <span
                              className="absolute inset-0 rounded-full animate-ping"
                              style={{ background: "hsl(140 70% 52% / 0.6)" }}
                            />
                          )}
                          {/* Core dot */}
                          <span
                            className="relative rounded-full"
                            style={{
                              width: "10px",
                              height: "10px",
                              background: captions.isListening
                                ? "hsl(140 70% 58%)"
                                : "hsl(140 30% 28%)",
                              boxShadow: captions.isListening
                                ? "0 0 10px 3px hsl(140 70% 52% / 0.7), 0 0 4px hsl(140 80% 70% / 0.9)"
                                : "none",
                              transition: "background 0.4s ease, box-shadow 0.4s ease",
                            }}
                          />
                        </div>
                        <HeaderCaptionPanel
                          history={captions.captionHistory}
                          partial={captions.partialText}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <DPad
                  onUp={() => stepFrequency(1)}
                  onDown={() => stepFrequency(-1)}
                  onLeft={() => {
                    const i = TAB_ORDER.indexOf(activeTab);
                    if (i > 0) setActiveTab(TAB_ORDER[i - 1]);
                  }}
                  onRight={() => {
                    const i = TAB_ORDER.indexOf(activeTab);
                    if (i < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[i + 1]);
                  }}
                  onVm={captions.toggle}
                  onAb={() => setActiveChannel((ch) => ch === "A" ? "B" : "A")}
                  onBack={handleEnter}
                  onMenu={() => setActiveTab("settings")}
                />
                <div className="px-10">
                  <NumPad
                    onDigit={handleDigit}
                    onDecimal={handleDecimal}
                    onBackspace={handleBackspace}
                    onEnter={handleEnter}
                  />
                </div>
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
            </div>
          </div>

          {/* ── APRS tab ── */}
          <div className="flex flex-col flex-1 min-h-0 px-1 pt-8 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <APRSMessaging myCallsign={myCallsign} onNavigateToSettings={() => setActiveTab("settings")} />
          </div>

          {/* ── Contacts tab ── */}
          <div className="flex flex-col flex-1 min-h-0 px-1 pt-8 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <ContactsScreen
              onTuneChannel={(freq) => {
                if (activeChannel === "A") setChannelA(freq);
                else setChannelB(freq);
              }}
              activeChannel={activeChannel}
            />
          </div>

          {/* ── Scanner tab ── */}
          <div className="flex flex-col flex-1 min-h-0 px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <div className="tab-panel flex flex-1 flex-col w-full">
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

          {/* ── Map tab ── */}
          <div className="flex flex-col flex-1 min-h-0 px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <div className="tab-panel flex flex-1 flex-col w-full">
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

          {/* ── Settings tab ── */}
          <div className="flex flex-col flex-1 min-h-0 px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <SettingsScreen myCallsign={myCallsign} onCallsignChange={handleCallsignChange} captionsLang={captions.lang} onCaptionsLangChange={captions.setLang} />
          </div>
        </div>
        </div>
      </main>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
