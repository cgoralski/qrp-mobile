import { useState, useCallback } from "react";
import { Mic } from "lucide-react";

const PTTButton = () => {
  const [isPressed, setIsPressed] = useState(false);

  const handleDown = useCallback(() => setIsPressed(true), []);
  const handleUp = useCallback(() => setIsPressed(false), []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Outer ring */}
      <div
        className={`rounded-full p-1 transition-all duration-200 ${
          isPressed ? "ptt-ring-active" : ""
        }`}
      >
        {/* Inner ring */}
        <div className={`rounded-full p-[3px] transition-all duration-200 ${
          isPressed
            ? "bg-gradient-to-b from-transmit/60 to-transmit/30"
            : "bg-gradient-to-b from-border/60 to-border/30"
        }`}>
          <button
            onMouseDown={handleDown}
            onMouseUp={handleUp}
            onMouseLeave={handleUp}
            onTouchStart={handleDown}
            onTouchEnd={handleUp}
            onTouchCancel={handleUp}
            className={`
              flex h-20 w-20 items-center justify-center rounded-full transition-all duration-150 select-none
              sm:h-24 sm:w-24
              ${
                isPressed
                  ? "bg-gradient-to-b from-transmit to-red-700 scale-[0.97]"
                  : "bg-gradient-to-b from-secondary to-muted ptt-ring active:scale-[0.97]"
              }
            `}
            aria-label="Push to talk"
          >
            <Mic
              className={`h-8 w-8 transition-all duration-150 sm:h-9 sm:w-9 ${
                isPressed
                  ? "text-transmit-foreground drop-shadow-lg"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        </div>
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors duration-150 ${
          isPressed ? "text-transmit animate-pulse-glow" : "text-muted-foreground"
        }`}
      >
        {isPressed ? "TRANSMITTING" : "PUSH TO TALK"}
      </span>
    </div>
  );
};

export default PTTButton;
