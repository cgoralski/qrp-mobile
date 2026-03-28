import { Delete } from "lucide-react";

interface NumPadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  /** Opens squelch slider (replaces Enter on this row; Enter remains on D-pad). */
  onSq: () => void;
}

const digitRows = [
  [
    { label: "1", sub: ".,?" },
    { label: "2", sub: "ABC" },
    { label: "3", sub: "DEF" },
  ],
  [
    { label: "4", sub: "GHI" },
    { label: "5", sub: "JKL" },
    { label: "6", sub: "MNO" },
  ],
  [
    { label: "7", sub: "PQRS" },
    { label: "8", sub: "TUV" },
    { label: "9", sub: "WXYZ" },
  ],
];

const buttonBase = {
  background: "linear-gradient(180deg, hsl(215 12% 28%), hsl(215 14% 18%) 40%, hsl(215 14% 14%))",
  border: "1px solid hsl(215 10% 32%)",
  borderBottom: "2px solid hsl(215 10% 10%)",
  borderTop: "1px solid hsl(215 10% 38%)",
  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.08), 0 2px 4px hsl(220 20% 4% / 0.5)",
} as const;

const actionBase = {
  background: "linear-gradient(180deg, hsl(215 12% 26%), hsl(215 14% 16%) 40%, hsl(215 14% 12%))",
  border: "1px solid hsl(215 10% 30%)",
  borderBottom: "2px solid hsl(215 10% 9%)",
  borderTop: "1px solid hsl(215 10% 36%)",
  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.06), 0 2px 4px hsl(220 20% 4% / 0.5)",
} as const;

const NumPad = ({ onDigit, onDecimal, onBackspace, onSq }: NumPadProps) => {
  return (
    <div className="w-full flex flex-col gap-0.5">
      {digitRows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex flex-col gap-0.5">
          <div className="grid grid-cols-3 gap-1">
            {row.map((key) => (
              <button
                key={key.label}
                onClick={() => onDigit(key.label)}
                className="group relative flex items-baseline justify-start rounded-md px-2.5 py-3.5 transition-all duration-75 active:scale-[0.96] active:brightness-125 select-none"
                style={buttonBase}
              >
                <span className="font-mono-display text-lg font-bold text-white/90 leading-none">
                  {key.label}
                </span>
                <span className="font-mono-display text-[11px] font-semibold tracking-wide text-blue-400/70 ml-1.5 leading-none">
                  {key.sub}
                </span>
              </button>
            ))}
          </div>
          {/* Row separator */}
          <div
            className="h-[2px] mx-1 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent 5%, hsl(215 10% 12%) 20%, hsl(215 10% 22%) 50%, hsl(215 10% 12%) 80%, transparent 95%)",
            }}
          />
        </div>
      ))}

      {/* Bottom digit row: . / 0 / # */}
      <div className="grid grid-cols-3 gap-1">
        {/* Decimal point */}
        <button
          onClick={onDecimal}
          className="group relative flex items-baseline justify-start rounded-md px-2.5 py-3.5 transition-all duration-75 active:scale-[0.96] active:brightness-125 select-none"
          style={buttonBase}
          aria-label="Decimal point"
        >
          <span className="font-mono-display text-lg font-bold text-white/90 leading-none">·</span>
          <span className="font-mono-display text-[11px] font-semibold tracking-wide text-blue-400/70 ml-1.5 leading-none">MHz</span>
        </button>
        {/* 0 */}
        <button
          onClick={() => onDigit("0")}
          className="group relative flex items-baseline justify-start rounded-md px-2.5 py-3.5 transition-all duration-75 active:scale-[0.96] active:brightness-125 select-none"
          style={buttonBase}
        >
          <span className="font-mono-display text-lg font-bold text-white/90 leading-none">0</span>
          <span className="font-mono-display text-[11px] font-semibold tracking-wide text-blue-400/70 ml-1.5 leading-none">+</span>
        </button>
        {/* # */}
        <button
          onClick={() => onDigit("#")}
          className="group relative flex items-baseline justify-start rounded-md px-2.5 py-3.5 transition-all duration-75 active:scale-[0.96] active:brightness-125 select-none"
          style={buttonBase}
        >
          <span className="font-mono-display text-lg font-bold text-white/90 leading-none">#</span>
          <span className="font-mono-display text-[11px] font-semibold tracking-wide text-blue-400/70 ml-1.5 leading-none">⇧</span>
        </button>
      </div>

      {/* DEL / SQ row */}
      <div className="grid grid-cols-2 gap-1 mt-0.5">
        <button
          onClick={onBackspace}
          className="flex items-center justify-center gap-2 rounded-md px-3 py-3.5 transition-all duration-75 active:scale-[0.96] select-none"
          style={actionBase}
          aria-label="Backspace"
        >
          <Delete className="h-4 w-4 text-white/50" />
          <span className="font-mono-display text-[13px] font-bold tracking-wider text-white/50">DEL</span>
        </button>
        <button
          onClick={onSq}
          className="flex items-center justify-center gap-2 rounded-md px-3 py-3.5 transition-all duration-75 active:scale-[0.96] select-none"
          style={actionBase}
          aria-label="Squelch"
        >
          <span className="font-mono-display text-[13px] font-bold tracking-wider text-blue-400/80">SQ</span>
        </button>
      </div>
    </div>
  );
};

export default NumPad;

