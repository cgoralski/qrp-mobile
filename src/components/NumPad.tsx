import { Delete, Star, Hash } from "lucide-react";

interface NumPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
}

const keys = [
  [
    { label: "1", sub: "" },
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
    { label: "*", sub: "", icon: "star" },
    { label: "0", sub: "+" },
    { label: "#", sub: "", icon: "hash" },
  ],
];

const NumPad = ({ onDigit, onBackspace, onEnter }: NumPadProps) => {
  return (
    <div className="w-full flex flex-col gap-2">
      {/* Key grid */}
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((key) => (
          <button
            key={key.label}
            onClick={() => onDigit(key.label)}
            className="group relative flex flex-col items-center justify-center rounded-xl py-3 transition-all duration-100 active:scale-[0.95]"
            style={{
              background: "linear-gradient(180deg, hsl(210 18% 16%), hsl(210 18% 11%))",
              border: "1px solid hsl(210 15% 22% / 0.5)",
              boxShadow: "0 2px 8px hsl(220 30% 3% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
            }}
          >
            <span className="font-mono-display text-lg font-bold text-foreground leading-none">
              {key.label}
            </span>
            {key.sub && (
              <span className="font-mono-display text-[8px] tracking-[0.15em] text-muted-foreground mt-0.5">
                {key.sub}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom row: Backspace / Enter */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBackspace}
          className="flex items-center justify-center gap-2 rounded-xl py-3 transition-all duration-100 active:scale-[0.95]"
          style={{
            background: "linear-gradient(180deg, hsl(210 18% 14%), hsl(210 18% 10%))",
            border: "1px solid hsl(210 15% 20% / 0.5)",
            boxShadow: "0 2px 8px hsl(220 30% 3% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
          }}
          aria-label="Backspace"
        >
          <Delete className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono-display text-[10px] font-semibold tracking-wider text-muted-foreground">
            DEL
          </span>
        </button>
        <button
          onClick={onEnter}
          className="flex items-center justify-center gap-2 rounded-xl py-3 transition-all duration-100 active:scale-[0.95]"
          style={{
            background: "linear-gradient(180deg, hsl(185 80% 55% / 0.15), hsl(185 80% 55% / 0.05))",
            border: "1px solid hsl(185 80% 55% / 0.2)",
            boxShadow: "0 2px 8px hsl(220 30% 3% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
          }}
          aria-label="Enter frequency"
        >
          <span className="font-mono-display text-[10px] font-bold tracking-wider text-primary">
            ENT
          </span>
        </button>
      </div>
    </div>
  );
};

export default NumPad;
