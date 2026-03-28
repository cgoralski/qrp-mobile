import { useState } from "react";
import { ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react";

const navButtonStyle = (position: "center" | "side") => ({
  background:
    position === "center"
      ? "linear-gradient(145deg, hsl(215 60% 28%), hsl(215 55% 18%))"
      : "linear-gradient(180deg, hsl(215 12% 26%), hsl(215 14% 16%) 40%, hsl(215 14% 12%))",
  border: "1px solid hsl(215 10% 32%)",
  borderBottom: position === "center" ? "2px solid hsl(215 10% 10%)" : "2px solid hsl(215 10% 9%)",
  borderTop: "1px solid hsl(215 10% 38%)",
  boxShadow:
    position === "center"
      ? "inset 0 1px 0 hsl(0 0% 100% / 0.12), 0 2px 6px hsl(220 20% 4% / 0.7)"
      : "inset 0 1px 0 hsl(0 0% 100% / 0.08), 0 2px 4px hsl(220 20% 4% / 0.5)",
});

interface DPadProps {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onOk?: () => void;
  onPttDown?: () => void;
  onPttUp?: () => void;
  onMenu?: () => void;
  onBack?: () => void;
  onVm?: () => void;
  onAb?: () => void;
}

const DPad = ({
  onUp,
  onDown,
  onLeft,
  onRight,
  onOk,
  onPttDown,
  onPttUp,
  onMenu,
  onBack,
  onVm,
  onAb,
}: DPadProps) => {
  const [isPttPressed, setIsPttPressed] = useState(false);

  const sideBtn = (label: string, sub: string | null, onClick?: () => void) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-md transition-all duration-75 active:scale-[0.95] active:brightness-125 select-none"
      style={{
        ...navButtonStyle("side"),
        width: "56px",
        height: "44px",
      }}
    >
      <span className="font-mono-display text-[12px] font-bold text-white/80 leading-none">{label}</span>
      {sub && (
        <span className="font-mono-display text-[9px] text-blue-400/60 leading-none mt-0.5">{sub}</span>
      )}
    </button>
  );

  const arrowBtn = (
    icon: React.ReactNode,
    onClick?: () => void,
    extraStyle?: React.CSSProperties
  ) => (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-md transition-all duration-75 active:scale-[0.95] active:brightness-125 select-none"
      style={{
        ...navButtonStyle("side"),
        width: "52px",
        height: "44px",
        ...extraStyle,
      }}
    >
      {icon}
    </button>
  );

  return (
    <div className="w-full flex justify-center py-3">
      <div className="flex items-center gap-1.5 px-8">
      {/* Left side buttons: MENU + A/B */}
      <div className="flex flex-col gap-3 shrink-0">
        {sideBtn("MENU", null, onMenu)}
        {sideBtn("A/B", null, onAb)}
      </div>

      {/* D-pad cross */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        {/* Up — V+ (volume up) */}
        <div className="flex justify-center">
          {arrowBtn(
            <span className="font-mono-display text-[13px] font-bold text-white/80">V+</span>,
            onUp
          )}
        </div>
        {/* Middle row: Left + OK + Right */}
        <div className="flex items-center gap-0.5">
          {arrowBtn(
            <ChevronLeft className="h-5 w-5 text-white/70" />,
            onLeft,
            { marginLeft: "8px" }
          )}
          {/* OK center button — PTT (enlarged as primary action); press = TX red bloom, release = RX; lighter when pressed */}
          <button
            onClick={onOk}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsPttPressed(true); onPttDown?.(); }}
            onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); setIsPttPressed(false); onPttUp?.(); }}
            onPointerLeave={() => { setIsPttPressed(false); onPttUp?.(); }}
            onPointerCancel={() => { setIsPttPressed(false); onPttUp?.(); }}
            className="flex items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.98] select-none p-12 touch-none"
            style={{
              ...navButtonStyle("center"),
              ...(isPttPressed && {
                background: "linear-gradient(145deg, hsl(215 55% 38%), hsl(215 50% 28%))",
                boxShadow: "inset 0 2px 0 hsl(0 0% 100% / 0.2), inset 0 -1px 0 hsl(0 0% 0% / 0.2), 0 2px 6px hsl(220 20% 4% / 0.7)",
              }),
              width: "92px",
              height: "80px",
              marginLeft: "10px",
              marginRight: "10px",
            }}
          >
            <span className="font-mono-display text-[15px] font-black text-blue-300/90 tracking-wider">PTT</span>
          </button>
          {arrowBtn(
            <ChevronRight className="h-5 w-5 text-white/70" />,
            onRight,
            { marginRight: "8px" }
          )}
        </div>
        {/* Down — V- (volume down) */}
        <div className="flex justify-center">
          {arrowBtn(
            <span className="font-mono-display text-[13px] font-bold text-white/80">V−</span>,
            onDown
          )}
        </div>
      </div>

      {/* Right side buttons: CC + BACK */}
      <div className="flex flex-col gap-3 shrink-0">
        {sideBtn("CC", null, onVm)}
        <button
          onClick={onBack}
          className="flex flex-col items-center justify-center rounded-md transition-all duration-75 active:scale-[0.95] active:brightness-125 select-none"
          style={{
            ...navButtonStyle("side"),
            width: "56px",
            height: "44px",
          }}
        >
          <CornerDownLeft className="h-5 w-5 text-white/80" />
        </button>
      </div>
      </div>
    </div>
  );
};

export default DPad;
