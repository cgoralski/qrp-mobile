import { Delete } from "lucide-react";

interface NumPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
}

const keys = [
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
  [
    { label: "*", sub: "⌴" },
    { label: "0", sub: "+" },
    { label: "#", sub: "⇧" },
  ],
];

const NumPad = ({ onDigit, onBackspace, onEnter }: NumPadProps) => {
  return (
    <div className="w-full flex flex-col gap-1">
      {keys.map((row, rowIdx) => (
        <div key={rowIdx} className="flex flex-col gap-1">
          <div className="grid grid-cols-3 gap-1.5">
            {row.map((key) => (
              <button
                key={key.label}
                onClick={() => onDigit(key.label)}
                className="group relative flex items-baseline justify-start rounded-md px-3 py-2.5 transition-all duration-75 active:scale-[0.96] active:brightness-125 select-none"
                style={{
                  background: "linear-gradient(180deg, hsl(215 12% 28%), hsl(215 14% 18%) 40%, hsl(215 14% 14%))",
                  border: "1px solid hsl(215 10% 32%)",
                  borderBottom: "2px solid hsl(215 10% 10%)",
                  borderTop: "1px solid hsl(215 10% 38%)",
                  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.08), 0 2px 4px hsl(220 20% 4% / 0.5)",
                }}
              >
                <span className="font-mono-display text-base font-bold text-white/90 leading-none">
                  {key.label}
                </span>
                <span className="font-mono-display text-[9px] font-semibold tracking-wide text-blue-400/70 ml-1 leading-none">
                  {key.sub}
                </span>
              </button>
            ))}
          </div>
          {/* Row separator — subtle ridge like the radio */}
          {rowIdx < keys.length - 1 && (
            <div
              className="h-[2px] mx-1 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent 5%, hsl(215 10% 12%) 20%, hsl(215 10% 22%) 50%, hsl(215 10% 12%) 80%, transparent 95%)",
              }}
            />
          )}
        </div>
      ))}

      {/* Bottom row: DEL / ENT */}
      <div className="grid grid-cols-2 gap-1.5 mt-1">
        <button
          onClick={onBackspace}
          className="flex items-center justify-center gap-2 rounded-md px-3 py-2.5 transition-all duration-75 active:scale-[0.96] select-none"
          style={{
            background: "linear-gradient(180deg, hsl(215 12% 26%), hsl(215 14% 16%) 40%, hsl(215 14% 12%))",
            border: "1px solid hsl(215 10% 30%)",
            borderBottom: "2px solid hsl(215 10% 9%)",
            borderTop: "1px solid hsl(215 10% 36%)",
            boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.06), 0 2px 4px hsl(220 20% 4% / 0.5)",
          }}
          aria-label="Backspace"
        >
          <Delete className="h-4 w-4 text-white/50" />
          <span className="font-mono-display text-[10px] font-bold tracking-wider text-white/50">
            DEL
          </span>
        </button>
        <button
          onClick={onEnter}
          className="flex items-center justify-center gap-2 rounded-md px-3 py-2.5 transition-all duration-75 active:scale-[0.96] select-none"
          style={{
            background: "linear-gradient(180deg, hsl(215 12% 26%), hsl(215 14% 16%) 40%, hsl(215 14% 12%))",
            border: "1px solid hsl(215 10% 30%)",
            borderBottom: "2px solid hsl(215 10% 9%)",
            borderTop: "1px solid hsl(215 10% 36%)",
            boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.06), 0 2px 4px hsl(220 20% 4% / 0.5)",
          }}
          aria-label="Enter frequency"
        >
          <span className="font-mono-display text-[10px] font-bold tracking-wider text-blue-400/80">
            ENT
          </span>
        </button>
      </div>
    </div>
  );
};

export default NumPad;
