import { useState, useRef, useCallback } from "react";

interface FrequencyInputProps {
  value: string;
  onChange: (value: string) => void;
}

const FrequencyInput = ({ value, onChange }: FrequencyInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9.]/g, "");

    // Only allow one decimal point
    const parts = raw.split(".");
    if (parts.length > 2) {
      raw = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit decimal places to 4
    if (parts.length === 2 && parts[1].length > 4) {
      raw = parts[0] + "." + parts[1].slice(0, 4);
    }

    // Limit integer part to 3 digits
    if (parts[0].length > 3) {
      raw = parts[0].slice(0, 3) + (parts.length > 1 ? "." + parts[1] : "");
    }

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

  return (
    <div className="flex flex-col items-center gap-3">
      <label className="text-xs uppercase tracking-widest text-muted-foreground">
        Frequency MHz
      </label>
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => stepFrequency(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors active:bg-muted"
          aria-label="Decrease frequency"
        >
          <span className="text-lg font-semibold">−</span>
        </button>

        <div
          className="panel-inset glow-primary-sm flex cursor-text items-center rounded-xl border border-border px-5 py-3"
          onClick={() => inputRef.current?.focus()}
        >
          <span className="font-mono-display text-3xl font-bold tracking-wider text-primary text-glow sm:text-4xl">
            {formattedDisplay()}
          </span>
          <span className="ml-2 text-sm text-muted-foreground">MHz</span>
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
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors active:bg-muted"
          aria-label="Increase frequency"
        >
          <span className="text-lg font-semibold">+</span>
        </button>
      </div>
    </div>
  );
};

export default FrequencyInput;
