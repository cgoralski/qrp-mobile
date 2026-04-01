import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, BookUser, Radio as RadioIcon } from "lucide-react";
import type { TabId } from "@/components/BottomTabBar";
import RadioScreen from "@/components/RadioScreen";
import NumPad from "@/components/NumPad";
import DPad from "@/components/DPad";
import ConnectionStatus from "@/components/ConnectionStatus";
import WifiProvisioningModal from "@/components/WifiProvisioningModal";
import { getSavedWifiHost, getSavedWifiPort } from "@/lib/wifi-storage";
import { getPersistedRadioState, setPersistedRadioState, setPersistedVolume } from "@/lib/radio-storage";
import APRSMessaging from "@/components/APRSMessaging";
import ContactsScreen from "@/components/ContactsScreen";
import MapScreen from "@/components/MapScreen";
import SerialLogScreen from "@/components/SerialLogScreen";
import SettingsScreen from "@/components/SettingsScreen";
import { useCaptions } from "@/hooks/use-captions";
import { useTxAudio } from "@/hooks/useTxAudio";
import { usePostPttRxRecovery } from "@/hooks/useRxAudioPlayback";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useKv4p } from "@/contexts/Kv4pContext";
import { CMD_HOST_TX_AUDIO } from "@/lib/kv4p-protocol";
import { BAND_CONFIGS, type BandId } from "@/lib/hardware";


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




/* ── Speaker grille (diagonal grill cloth pattern) ── */
const SpeakerGrille = () => (
  <div
    className="w-full px-3 py-1.5 min-h-[28px] rounded-b-xl"
    style={{
      backgroundColor: "hsl(220 12% 5%)",
      backgroundImage: [
        "linear-gradient(45deg, hsl(220 10% 12% / 0.5) 0%, transparent 1px)",
        "linear-gradient(-45deg, hsl(220 10% 12% / 0.5) 0%, transparent 1px)",
      ].join(", "),
      backgroundSize: "8px 8px",
      boxShadow: "inset 0 1px 2px hsl(0 0% 0% / 0.5)",
    }}
  />
);

const TAB_ORDER: TabId[] = ["voice", "aprs", "contacts", "scanner", "map", "serial", "settings"];

/**
 * Survives Index unmount (HashRouter → Wi-Fi console). If this lived in useRef, leaving the radio
 * page reset it and remounting re-fired STOP+GROUP — RX audio died until another GROUP (e.g. VFO tap).
 */
let initialStopAndGroupDoneForThisConnection = false;

const Index = () => {
  const navigate = useNavigate();
  const persistedRadio = useMemo(() => getPersistedRadioState(), []);
  const [channelA, setChannelA] = useState(persistedRadio.channelA);
  const [channelB, setChannelB] = useState(persistedRadio.channelB);
  const [activeChannel, setActiveChannel] = useState<"A" | "B">(persistedRadio.activeChannel);
  const [inputBuffer, setInputBuffer] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("voice");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const isTransmittingRef = useRef(false);
  useEffect(() => {
    isTransmittingRef.current = isTransmitting;
  }, [isTransmitting]);
  const [channelAName, setChannelAName] = useState(persistedRadio.channelAName);
  const [channelBName, setChannelBName] = useState(persistedRadio.channelBName);
  const [squelchA, setSquelchA] = useState(persistedRadio.squelchA);
  const [squelchB, setSquelchB] = useState(persistedRadio.squelchB);
  const squelch = activeChannel === "A" ? squelchA : squelchB;

  const radioPersistSkipFirst = useRef(true);
  useEffect(() => {
    if (radioPersistSkipFirst.current) {
      radioPersistSkipFirst.current = false;
      return;
    }
    setPersistedRadioState({
      ...getPersistedRadioState(),
      channelA,
      channelB,
      activeChannel,
      channelAName,
      channelBName,
      squelchA,
      squelchB,
    });
  }, [channelA, channelB, activeChannel, channelAName, channelBName, squelchA, squelchB]);
  const [txPower, setTxPower] = useState<"high" | "low">("low");
  const [myCallsign, setMyCallsign] = useState<string>(
    () => localStorage.getItem("myCallsign") ?? ""
  );
  // Track live swipe offset for real-time drag feedback
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  /**
   * boardBand — the frequency band reported by the connected hardware board.
   *
   * Set this state whenever the board replies to the identify/config command
   * via the USB-C serial connection. Use resolveBoardType(rawReply) from
   * src/lib/hardware.ts to convert the raw reply string to a BandId.
   *
   * Example (once USB serial is implemented):
   *   const band = resolveBoardType(serialReply);
   *   setBoardBand(band);
   *
   * null  = no board connected or board type not recognised (no filtering)
   * "VHF" = 144–148 MHz filter applied
   * "UHF" = 430–440 MHz filter applied
   * "DUAL"= dual-band board — no frequency filtering applied
   */
  const [boardBand, setBoardBand] = useState<BandId>(null);

  const captions = useCaptions();
  const {
    connected,
    connectionType,
    deviceName,
    connecting,
    error,
    connect,
    connectViaUsb,
    connectViaWifi,
    isBluetoothSupported,
    isSerialSupported,
    isWifiSupported,
    rxPlaybackHandleRef,
  } = useDeviceConnection();
  const { rssi: deviceRssi, sendPttDown, sendPttUp, sendGroup, sendStop, sendCommand, requestVersion, version: deviceVersion } = useKv4p();

  // Capture mic and send TX Opus frames to device while PTT is down and connected
  const onTxEncoded = useCallback((data: Uint8Array) => sendCommand(CMD_HOST_TX_AUDIO, data), [sendCommand]);
  useTxAudio(connected && isTransmitting, connected && isTransmitting ? onTxEncoded : null);
  usePostPttRxRecovery(isTransmitting);

  // Set board band from device version (rfModuleType: 0 = VHF, 1 = UHF)
  useEffect(() => {
    if (!deviceVersion) return;
    const band: BandId = deviceVersion.rfModuleType === 0 ? "VHF" : deviceVersion.rfModuleType === 1 ? "UHF" : null;
    setBoardBand(band);
  }, [deviceVersion]);

  // RSSI from device when connected; 0 when disconnected (no mock data)
  const displayRssi = connected ? deviceRssi : 0;

  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Squelch slider debounce — do not tie to `sendGroupNow` identity (that changes every VFO/freq edit). */
  const squelchGroupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wifiProvisioningOpen, setWifiProvisioningOpen] = useState(false);
  const [squelchSliderOpen, setSquelchSliderOpen] = useState(false);
  const savedWifiHost = getSavedWifiHost();
  const savedWifiPort = getSavedWifiPort();

  const sendGroupNow = useCallback(
    (overrideFreq?: string) => {
      if (sendTimeoutRef.current !== null) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
      if (!connected) return;
      // Never send GROUP until handshake is done and we have version; otherwise the board ignores it and stays "deaf".
      if (!deviceVersion) return;
      const freqStr = overrideFreq ?? (activeChannel === "A" ? channelA : channelB);
      const freq = parseFloat(freqStr);
      if (Number.isNaN(freq)) {
        console.warn("[KV4P] GROUP not sent: invalid frequency", freqStr);
        return;
      }
      console.log("[KV4P] Sending GROUP freqTx=" + freq + " freqRx=" + freq + " squelch=" + squelch);
      sendGroup({ freqTx: freq, freqRx: freq, squelch });
    },
    [connected, deviceVersion, activeChannel, channelA, channelB, squelch, sendGroup]
  );
  const sendGroupNowRef = useRef(sendGroupNow);
  sendGroupNowRef.current = sendGroupNow;

  // If we still have no version after handshake (and 2s retry), send CONFIG once more. Delay until
  // after HELLO timeout (3s) so we never send CONFIG before STOP.
  useEffect(() => {
    if (!connected || deviceVersion) return;
    const t = window.setTimeout(() => requestVersion(), 4500);
    return () => window.clearTimeout(t);
  }, [connected, deviceVersion, requestVersion]);

  // Match Android handshake: send GROUP only after we have received COMMAND_VERSION from the board.
  // Send STOP first so the board is in MODE_STOPPED; then GROUP so it transitions to MODE_RX and starts RX audio.
  // Retry GROUP once after 250ms so a single lost packet doesn't require replugging.
  useEffect(() => {
    if (!connected) {
      initialStopAndGroupDoneForThisConnection = false;
      return;
    }
    if (!deviceVersion || initialStopAndGroupDoneForThisConnection) {
      return;
    }
    sendStop();
    const t1 = window.setTimeout(() => {
      sendGroupNow();
      groupRetryRef.current = window.setTimeout(() => {
        sendGroupNowRef.current();
        initialStopAndGroupDoneForThisConnection = true;
        groupRetryRef.current = null;
      }, 250);
    }, 100);
    return () => {
      window.clearTimeout(t1);
      if (groupRetryRef.current !== null) {
        window.clearTimeout(groupRetryRef.current);
        groupRetryRef.current = null;
      }
    };
  }, [connected, deviceVersion, sendGroupNow, sendStop]);

  // On VFO switch (A ↔ B), send GROUP immediately so the board tunes to the new channel and RX audio flows without reboot.
  const prevActiveChannelRef = useRef<"A" | "B" | null>(null);
  useEffect(() => {
    if (!connected || !deviceVersion) return;
    if (prevActiveChannelRef.current !== null && prevActiveChannelRef.current !== activeChannel) {
      sendGroupNow();
    }
    prevActiveChannelRef.current = activeChannel;
  }, [connected, deviceVersion, activeChannel, sendGroupNow]);

  // Debounce: send frequency 800ms after keypad edits to channel A/B only.
  // Do not depend on activeChannel — VFO A↔B already sends GROUP immediately; including activeChannel
  // scheduled a duplicate GROUP ~800ms after every switch (second SA818 retune → audible drop).
  useEffect(() => {
    if (!connected) return;
    sendTimeoutRef.current = setTimeout(() => sendGroupNowRef.current(), 800);
    return () => {
      if (sendTimeoutRef.current !== null) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    };
  }, [connected, channelA, channelB]);

  // Apply squelch to the module only when squelchA/B (or link/version) change — not when `sendGroupNow`
  // is recreated on VFO/frequency edits. Otherwise every A↔B switch sent an extra GROUP and could race
  // the debounced frequency path, leaving RX silent until reconnect.
  useEffect(() => {
    if (!connected || !deviceVersion) {
      if (squelchGroupDebounceRef.current !== null) {
        clearTimeout(squelchGroupDebounceRef.current);
        squelchGroupDebounceRef.current = null;
      }
      return;
    }
    if (squelchGroupDebounceRef.current !== null) clearTimeout(squelchGroupDebounceRef.current);
    squelchGroupDebounceRef.current = setTimeout(() => {
      squelchGroupDebounceRef.current = null;
      sendGroupNowRef.current();
    }, 160);
    return () => {
      if (squelchGroupDebounceRef.current !== null) {
        clearTimeout(squelchGroupDebounceRef.current);
        squelchGroupDebounceRef.current = null;
      }
    };
  }, [connected, deviceVersion, squelchA, squelchB]);

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
  const mainRef = useRef<HTMLElement>(null);
  const handleSwipeTouchMoveRef = useRef<(e: React.TouchEvent) => void>(() => {});

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    // Don't capture swipes that start inside components that handle their own touch
    if ((e.target as Element).closest("[data-no-swipe]")) return;
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
  handleSwipeTouchMoveRef.current = handleSwipeTouchMove;

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => handleSwipeTouchMoveRef.current?.(e as unknown as React.TouchEvent);
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

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
    // Do not pad buffer so user can type 3rd digit before decimal (e.g. 497 then .)
    const next = inputBuffer + ".";
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
    sendGroupNow();
    setInputBuffer("");
  }, [sendGroupNow]);

  const stepFrequency = useCallback((direction: 1 | -1) => {
    const current = activeChannel === "A" ? channelA : channelB;
    const parsed = parseFloat(current);
    if (isNaN(parsed)) return;
    const stepped = Math.max(0, parsed + direction * 0.5);
    const formatted = stepped.toFixed(4).replace(/^(\d{1,3})/, (m) => m.padStart(3, "0"));
    setInputBuffer("");
    if (activeChannel === "A") setChannelA(formatted);
    else setChannelB(formatted);
    // GROUP is sent once by the debounce effect (800ms after last change) to avoid duplicate sends per click.
  }, [activeChannel, channelA, channelB]);

  return (
    <div className="flex h-[100dvh] flex-col bg-mesh overflow-hidden">
      {/* App header — chassis look on Voice tab, glass elsewhere */}
      <header
        className={`sticky top-0 z-50 flex items-center justify-between px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] ${activeTab !== "voice" ? "glass-header" : "rounded-t-2xl"}`}
        style={activeTab === "voice" ? {
          background:
            "linear-gradient(175deg, hsl(220 12% 16%) 0%, hsl(220 10% 11%) 60%, hsl(220 8% 8%) 100%)",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E\"), linear-gradient(175deg, hsl(220 12% 16%) 0%, hsl(220 10% 11%) 60%, hsl(220 8% 8%) 100%)",
          backgroundBlendMode: "overlay, normal",
          borderBottom: "1px solid hsl(220 10% 22%)",
          boxShadow: "inset 0 1px 0 hsl(0 0% 45% / 0.18)",
        } : undefined}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono-display text-sm font-semibold tracking-wider text-foreground">
            QRP<span className="text-primary text-glow">MOBILE</span>
          </span>
        </div>

        {/* Band badge + Powered by KV4P — when board is connected and identified */}
        {boardBand && (() => {
          const bandCfg = boardBand !== "DUAL" ? BAND_CONFIGS[boardBand] : null;
          const dualBand = boardBand === "DUAL";
          return (
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="font-mono-display font-bold tracking-wider px-2.5 py-1 rounded-full text-[10px]"
                style={{
                  background: dualBand
                    ? "hsl(185 80% 55% / 0.15)"
                    : bandCfg
                      ? `${bandCfg.color.replace(")", " / 0.15)")}`
                      : undefined,
                  border: dualBand
                    ? "1px solid hsl(185 80% 55% / 0.35)"
                    : bandCfg
                      ? `1px solid ${bandCfg.color.replace(")", " / 0.35)")}`
                      : undefined,
                  color: dualBand ? "hsl(185 80% 55%)" : bandCfg?.color,
                  boxShadow: bandCfg ? `0 0 10px ${bandCfg.color.replace(")", " / 0.35)")}` : undefined,
                }}
              >
                {dualBand ? "DUAL" : bandCfg?.badge}
              </span>
              <span className="font-mono-display text-[9px] font-medium tracking-wider text-muted-foreground/80 whitespace-nowrap">
                Powered by KV4P
              </span>
            </div>
          );
        })()}

        <ConnectionStatus
          connected={connected}
          connectionType={connectionType}
          boardBand={boardBand}
          deviceName={deviceName}
          connecting={connecting}
          error={error}
          onConnectBle={connect}
          onConnectUsb={connectViaUsb}
          onConnectWifi={connectViaWifi}
          savedWifiHost={savedWifiHost}
          savedWifiPort={savedWifiPort}
          defaultWifiHost="192.168.4.1"
          defaultWifiPort={8765}
          onOpenSetUpWifi={() => setWifiProvisioningOpen(true)}
          isBluetoothSupported={isBluetoothSupported}
          isSerialSupported={isSerialSupported}
          isWifiSupported={isWifiSupported}
          onOpenWifiDiagnostics={() => navigate("/wifi-console")}
        />
        <WifiProvisioningModal
          open={wifiProvisioningOpen}
          onOpenChange={setWifiProvisioningOpen}
          onSuccess={(ip) => connectViaWifi(ip, savedWifiPort)}
        />
        {/* Squelch slider popup: opens when SQ is pressed on numpad */}
        {squelchSliderOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4"
            onClick={() => setSquelchSliderOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl"
              style={{
                background: "linear-gradient(180deg, hsl(220 14% 14%) 0%, hsl(220 12% 10%) 100%)",
                border: "1px solid hsl(220 12% 24%)",
                boxShadow: "0 -8px 32px hsl(220 30% 2% / 0.9), 0 0 0 1px hsl(220 10% 20% / 0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono-display text-sm font-bold tracking-wider text-white/90">
                  Squelch
                </span>
                <span className="font-mono-display text-lg font-bold tabular-nums text-blue-400/90">
                  {squelch}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={squelch}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (activeChannel === "A") setSquelchA(v);
                  else setSquelchB(v);
                }}
                className="w-full h-3 rounded-full appearance-none cursor-pointer bg-[hsl(220,12%,22%)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[hsl(185,55%,50%)] [&::-webkit-slider-thumb]:shadow-[0_0_6px_hsl(185,60%,50%,0.6)] [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[hsl(185,55%,50%)]"
                style={{ accentColor: "hsl(185 55% 50%)" }}
                aria-label="Squelch level"
              />
              <div className="flex justify-between mt-1 px-0.5">
                <span className="font-mono-display text-[11px] text-white/45">Open</span>
                <span className="font-mono-display text-[11px] text-white/45">Tight</span>
              </div>
              <button
                type="button"
                onClick={() => setSquelchSliderOpen(false)}
                className="mt-4 w-full py-2.5 rounded-lg font-mono-display text-sm font-bold tracking-wider transition-colors"
                style={{
                  background: "hsl(220 14% 22%)",
                  color: "hsl(0 0% 90%)",
                  border: "1px solid hsl(220 12% 30%)",
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Radio body shell ── */}
      <main
        ref={mainRef}
        className="flex flex-1 flex-col min-h-0 max-w-[480px] mx-auto w-full"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
        style={{ touchAction: "pan-x pan-y" }}
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
                    rssi={displayRssi}
                    isTransmitting={isTransmitting}
                    txPower={txPower}
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
                  onUp={() => {
                    rxPlaybackHandleRef.current?.volumeUp();
                    const v = rxPlaybackHandleRef.current?.getVolume();
                    if (v != null) setPersistedVolume(v);
                  }}
                  onDown={() => {
                    rxPlaybackHandleRef.current?.volumeDown();
                    const v = rxPlaybackHandleRef.current?.getVolume();
                    if (v != null) setPersistedVolume(v);
                  }}
                  onLeft={() => {
                    const i = TAB_ORDER.indexOf(activeTab);
                    if (i > 0) setActiveTab(TAB_ORDER[i - 1]);
                  }}
                  onRight={() => {
                    const i = TAB_ORDER.indexOf(activeTab);
                    if (i < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[i + 1]);
                  }}
                  onOk={handleEnter}
                  onPttDown={() => {
                    if (connected) {
                      sendPttDown();
                      setIsTransmitting(true);
                    } else if (displayRssi <= 3) {
                      setIsTransmitting(true);
                    }
                  }}
                  onPttUp={() => {
                    if (connected) sendPttUp();
                    setIsTransmitting(false);
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
                    onSq={() => setSquelchSliderOpen(true)}
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
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <APRSMessaging myCallsign={myCallsign} onNavigateToSettings={() => setActiveTab("settings")} />
          </div>

          {/* ── Contacts tab ── */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <ContactsScreen
              onTuneChannel={(freq, channelName) => {
                if (activeChannel === "A") {
                  setChannelA(freq);
                  setChannelAName(channelName || "CH A");
                } else {
                  setChannelB(freq);
                  setChannelBName(channelName || "CH B");
                }
                sendGroupNow(freq);
              }}
              activeChannel={activeChannel}
              boardBand={boardBand}
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
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <MapScreen myCallsign={myCallsign} />
          </div>

          {/* ── Serial log tab ── */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <SerialLogScreen />
          </div>

          {/* ── Settings tab ── */}
          <div className="flex flex-col flex-1 min-h-0 px-1 pt-4 pb-1" style={{ width: `${100 / TAB_ORDER.length}%`, flexShrink: 0 }}>
            <SettingsScreen myCallsign={myCallsign} onCallsignChange={handleCallsignChange} captionsLang={captions.lang} onCaptionsLangChange={captions.setLang} />
          </div>
        </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
