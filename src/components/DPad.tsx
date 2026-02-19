import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react";

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
  onMenu,
  onBack,
  onVm,
  onAb,
}: DPadProps) => {
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
      className="flex items-center justify-center rounded-sm transition-all duration-75 active:scale-[0.95] active:brightness-125 select-none"
      style={{
        ...navButtonStyle("side"),
        width: "44px",
        height: "36px",
        ...extraStyle,
      }}
    >
      {icon}
    </button>
  );

  return (
    <div className="w-full flex items-center gap-1.5 px-8 py-3">
      {/* Left side buttons: MENU + A/B */}
      <div className="flex flex-col gap-1">
        {sideBtn("MENU", null, onMenu)}
        {sideBtn("A/B", null, onAb)}
      </div>

      {/* D-pad cross */}
      <div className="flex-1 flex flex-col items-center gap-0.5">
        {/* Up */}
        <div className="flex justify-center">
          {arrowBtn(
            <ChevronUp className="h-4 w-4 text-white/70" />,
            onUp
          )}
        </div>
        {/* Middle row: Left + OK + Right */}
        <div className="flex items-center gap-0.5">
          {arrowBtn(
            <ChevronLeft className="h-4 w-4 text-white/70" />,
            onLeft
          )}
          {/* OK center button */}
          <button
            onClick={onOk}
            className="flex items-center justify-center rounded-md transition-all duration-75 active:scale-[0.95] active:brightness-125 select-none"
            style={{
              ...navButtonStyle("center"),
              width: "78px",
              height: "64px",
            }}
          >
            <span className="font-mono-display text-[13px] font-black text-blue-300/90 tracking-wider">PTT</span>
          </button>
          {arrowBtn(
            <ChevronRight className="h-4 w-4 text-white/70" />,
            onRight
          )}
        </div>
        {/* Down */}
        <div className="flex justify-center">
          {arrowBtn(
            <ChevronDown className="h-4 w-4 text-white/70" />,
            onDown
          )}
        </div>
      </div>

      {/* Right side buttons: CC + BACK */}
      <div className="flex flex-col gap-1">
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
  );
};

export default DPad;
