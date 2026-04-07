import { useState, useRef, useEffect, type CSSProperties, type MutableRefObject } from "react";
import RadioScreen from "@/components/RadioScreen";
import NumPad from "@/components/NumPad";
import DPad from "@/components/DPad";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";

export interface VoiceTabCaptionsState {
  isActive: boolean;
  toggle: () => void;
  partialText: string;
  captionHistory: string[];
  isSupported: boolean;
  isListening: boolean;
}

export interface VoiceTabPanelProps {
  stripColumnStyle: CSSProperties;
  channelA: string;
  channelB: string;
  onChannelAChange: (v: string) => void;
  onChannelBChange: (v: string) => void;
  activeChannel: "A" | "B";
  onActiveChannelChange: (v: "A" | "B") => void;
  displayRssi: number;
  isTransmitting: boolean;
  txPower: "high" | "low";
  channelAName: string;
  channelBName: string;
  onChannelANameChange: (v: string) => void;
  onChannelBNameChange: (v: string) => void;
  myCallsign: string;
  captions: VoiceTabCaptionsState;
  rxPlaybackHandleRef: MutableRefObject<RxPlaybackHandle | null>;
  onPersistVolume: (v: number) => void;
  onTabPrev: () => void;
  onTabNext: () => void;
  onEnter: () => void;
  onDigit: (d: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  onOpenSquelch: () => void;
  connected: boolean;
  onPttDown: () => void;
  onPttUp: () => void;
  onTransmittingChange: (v: boolean) => void;
  onOpenSettings: () => void;
}

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
    if (targetText.length < displayText.length) {
      setDisplayText(targetText);
      return;
    }
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

export default function VoiceTabPanel({
  stripColumnStyle,
  channelA,
  channelB,
  onChannelAChange,
  onChannelBChange,
  activeChannel,
  onActiveChannelChange,
  displayRssi,
  isTransmitting,
  txPower,
  channelAName,
  channelBName,
  onChannelANameChange,
  onChannelBNameChange,
  myCallsign,
  captions,
  rxPlaybackHandleRef,
  onPersistVolume,
  onTabPrev,
  onTabNext,
  onEnter,
  onDigit,
  onDecimal,
  onBackspace,
  onOpenSquelch,
  connected,
  onPttDown,
  onPttUp,
  onTransmittingChange,
  onOpenSettings,
}: VoiceTabPanelProps) {
  return (
    <div className="flex flex-col items-center justify-start py-1" style={stripColumnStyle}>
      <div className="w-full relative">
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <clipPath id="chassisClip" clipPathUnits="objectBoundingBox">
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
                onChannelAChange={onChannelAChange}
                onChannelBChange={onChannelBChange}
                activeChannel={activeChannel}
                onActiveChannelChange={onActiveChannelChange}
                rssi={displayRssi}
                isTransmitting={isTransmitting}
                txPower={txPower}
                channelAName={channelAName}
                channelBName={channelBName}
                onChannelANameChange={onChannelANameChange}
                onChannelBNameChange={onChannelBNameChange}
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
                  <div className="flex items-center gap-2.5 w-full">
                    <div
                      className="relative flex-shrink-0 flex items-center justify-center"
                      style={{ width: "16px", height: "16px" }}
                    >
                      {captions.isListening && (
                        <span
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ background: "hsl(140 70% 52% / 0.6)" }}
                        />
                      )}
                      <span
                        className="relative rounded-full"
                        style={{
                          width: "10px",
                          height: "10px",
                          background: captions.isListening ? "hsl(140 70% 58%)" : "hsl(140 30% 28%)",
                          boxShadow: captions.isListening
                            ? "0 0 10px 3px hsl(140 70% 52% / 0.7), 0 0 4px hsl(140 80% 70% / 0.9)"
                            : "none",
                          transition: "background 0.4s ease, box-shadow 0.4s ease",
                        }}
                      />
                    </div>
                    <HeaderCaptionPanel history={captions.captionHistory} partial={captions.partialText} />
                  </div>
                </div>
              </div>
            )}
            <DPad
              onUp={() => {
                rxPlaybackHandleRef.current?.volumeUp();
                const v = rxPlaybackHandleRef.current?.getVolume();
                if (v != null) onPersistVolume(v);
              }}
              onDown={() => {
                rxPlaybackHandleRef.current?.volumeDown();
                const v = rxPlaybackHandleRef.current?.getVolume();
                if (v != null) onPersistVolume(v);
              }}
              onLeft={onTabPrev}
              onRight={onTabNext}
              onOk={onEnter}
              onPttDown={() => {
                if (connected) {
                  onPttDown();
                  onTransmittingChange(true);
                } else if (displayRssi <= 3) {
                  onTransmittingChange(true);
                }
              }}
              onPttUp={() => {
                if (connected) onPttUp();
                onTransmittingChange(false);
              }}
              onVm={captions.toggle}
              onAb={() => onActiveChannelChange(activeChannel === "A" ? "B" : "A")}
              onBack={onEnter}
              onMenu={onOpenSettings}
            />
            <div className="px-10">
              <NumPad onDigit={onDigit} onDecimal={onDecimal} onBackspace={onBackspace} onSq={onOpenSquelch} />
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
  );
}
