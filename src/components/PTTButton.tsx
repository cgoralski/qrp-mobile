import { useState, useCallback } from "react";
import { Mic } from "lucide-react";

const PTTButton = () => {
  const [isPressed, setIsPressed] = useState(false);

  const handleDown = useCallback(() => setIsPressed(true), []);
  const handleUp = useCallback(() => setIsPressed(false), []);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onMouseDown={handleDown}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchEnd={handleUp}
        onTouchCancel={handleUp}
        className={`
          flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-150 select-none
          sm:h-24 sm:w-24
          ${
            isPressed
              ? "scale-95 border-transmit bg-transmit glow-transmit"
              : "border-border bg-secondary active:scale-95"
          }
        `}
        aria-label="Push to talk"
      >
        <Mic
          className={`h-8 w-8 transition-colors sm:h-10 sm:w-10 ${
            isPressed ? "text-transmit-foreground" : "text-foreground"
          }`}
        />
      </button>
      <span
        className={`text-xs font-semibold uppercase tracking-widest transition-colors ${
          isPressed ? "text-transmit animate-pulse-glow" : "text-muted-foreground"
        }`}
      >
        {isPressed ? "TX" : "PTT"}
      </span>
    </div>
  );
};

export default PTTButton;
