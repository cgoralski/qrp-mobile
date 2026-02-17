import { useState, useRef, useCallback } from "react";

interface FrequencyInputProps {
  value: string;
  onChange: (value: string) => void;
}

const FrequencyInput = ({ value, onChange }: FrequencyInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
    if (parts.length === 2 && parts[1].length > 4) raw = parts[0] + "." + parts[1].slice(0, 4);
    if (parts[0].length > 3) raw = parts[0].slice(0, 3) + (parts.length > 1 ? "." + parts[1] : "");
    onChange(raw);
  };

  const stepFrequency = useCallback(
    (direction: 1 | -1) => {
      const num = parseFloat(value) || 0;
      const stepped = Math.max(0, num + direction * 0.0025);
      onChange(stepped.toFixed(4));
    },
    [value, onChange]
  );

  const formattedDisplay = () => {
    if (!value) return "000.0000";
    const parts = value.split(".");
    const integer = parts[0].padStart(3, "0");
    const decimal = (parts[1] || "").padEnd(4, "0").slice(0, 4);
    return `${integer}.${decimal}`;
  };

  const digits = formattedDisplay();

  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
        Frequency
      </label>
      <div className="relative flex items-center gap-3">
        <button
          onClick={() => stepFrequency(-1)}
          className="glass-panel flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-primary/30 active:scale-95"
          aria-label="Decrease frequency"
        >
          <span className="text-xl font-light">−</span>
        </button>

        <div
          className="glass-panel-elevated relative glow-primary flex cursor-text items-baseline rounded-2xl px-6 py-4"
          onClick={() => inputRef.current?.focus()}
        >
          <span className="font-mono-display text-4xl font-bold tracking-[0.08em] text-primary text-glow sm:text-5xl">
            {digits}
          </span>
          <span className="ml-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            MHz
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={handleChange}
            className="absolute inset-0 h-full w-full cursor-text opacity-0"
            aria-label="Frequency input"
          />
        </div>

        <button
          onClick={() => stepFrequency(1)}
          className="glass-panel flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-primary/30 active:scale-95"
          aria-label="Increase frequency"
        >
          <span className="text-xl font-light">+</span>
        </button>
      </div>
    </div>
  );
};

export default FrequencyInput;
