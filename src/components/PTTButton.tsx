import { useState, useCallback } from "react";
import { Mic } from "lucide-react";

const PTTButton = () => {
  const [isPressed, setIsPressed] = useState(false);

  const handleDown = useCallback(() => setIsPressed(true), []);
  const handleUp = useCallback(() => setIsPressed(false), []);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* TX indicator LED */}
      <div className="flex items-center gap-2">
        <div
          className="rounded-full transition-all duration-150"
          style={{
            width: "7px",
            height: "7px",
            background: isPressed
              ? "hsl(var(--transmit))"
              : "hsl(0 0% 14%)",
            boxShadow: isPressed
              ? "0 0 8px hsl(var(--transmit) / 0.9), 0 0 20px hsl(var(--transmit) / 0.4)"
              : "inset 0 1px 2px hsl(0 0% 0% / 0.6)",
            border: "1px solid hsl(0 0% 10%)",
          }}
        />
        <span
          className="font-mono-display text-[9px] tracking-[0.25em] transition-colors duration-150"
          style={{ color: isPressed ? "hsl(var(--transmit))" : "hsl(0 0% 28%)" }}
        >
          {isPressed ? "TX" : "RX"}
        </span>
      </div>

      {/* Outer mounting bezel */}
      <div
        className="rounded-full p-[5px]"
        style={{
          background:
            "linear-gradient(145deg, hsl(220 12% 18%), hsl(220 10% 10%))",
          border: "1px solid hsl(220 10% 24%)",
          boxShadow:
            "inset 0 1px 0 hsl(0 0% 40% / 0.15), inset 0 -1px 0 hsl(0 0% 0% / 0.5), 0 6px 20px hsl(220 30% 2% / 0.8)",
        }}
      >
        {/* Recessed ring — simulates screwed-in bezel */}
        <div
          className="rounded-full p-[4px]"
          style={{
            background:
              "linear-gradient(145deg, hsl(220 10% 10%), hsl(220 12% 18%))",
            boxShadow:
              "inset 0 2px 5px hsl(220 30% 2% / 0.8), inset 0 0 0 1px hsl(220 10% 8%)",
          }}
        >
          {/* The button itself */}
          <button
            onMouseDown={handleDown}
            onMouseUp={handleUp}
            onMouseLeave={handleUp}
            onTouchStart={handleDown}
            onTouchEnd={handleUp}
            onTouchCancel={handleUp}
            aria-label="Push to talk"
            className="relative flex h-20 w-20 items-center justify-center rounded-full select-none transition-all duration-100 sm:h-24 sm:w-24 overflow-hidden"
            style={{
              background: isPressed
                ? "linear-gradient(160deg, hsl(var(--transmit) / 0.9), hsl(0 75% 42%))"
                : "linear-gradient(155deg, hsl(220 14% 24%), hsl(220 12% 14%))",
              boxShadow: isPressed
                ? "inset 0 3px 8px hsl(0 0% 0% / 0.5), 0 0 24px hsl(var(--transmit) / 0.4), 0 0 60px hsl(var(--transmit) / 0.15)"
                : "inset 0 -2px 0 hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 50% / 0.12), 0 4px 12px hsl(220 30% 2% / 0.7)",
              transform: isPressed ? "scale(0.96) translateY(1px)" : "scale(1)",
              border: isPressed
                ? "1px solid hsl(var(--transmit) / 0.4)"
                : "1px solid hsl(220 10% 28%)",
            }}
          >
            {/* Rubber grip texture rings */}
            {[1, 2, 3].map((r) => (
              <div
                key={r}
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: `${r * 7}px`,
                  border: `1px solid hsl(0 0% ${isPressed ? 30 : 20}% / 0.25)`,
                }}
              />
            ))}
            <Mic
              className="relative z-10 h-8 w-8 transition-all duration-100 sm:h-9 sm:w-9"
              style={{
                color: isPressed
                  ? "hsl(0 0% 100%)"
                  : "hsl(0 0% 45%)",
                filter: isPressed
                  ? "drop-shadow(0 0 4px hsl(0 0% 100% / 0.5))"
                  : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Label */}
      <span
        className="font-mono-display text-[9px] font-bold uppercase tracking-[0.3em] transition-all duration-150"
        style={{
          color: isPressed ? "hsl(var(--transmit))" : "hsl(0 0% 28%)",
          textShadow: isPressed ? "0 0 8px hsl(var(--transmit) / 0.5)" : "none",
        }}
      >
        {isPressed ? "TRANSMITTING" : "PUSH TO TALK"}
      </span>
    </div>
  );
};

export default PTTButton;
