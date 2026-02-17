import { useCallback } from "react";

interface SliderControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}

const SliderControl = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  unit = "",
}: SliderControlProps) => {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          {label}
        </span>
        <span className="font-mono-display text-sm font-semibold text-primary text-glow">
          {value}{unit}
        </span>
      </div>
      <div className="relative">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/80">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${percentage}%`,
              background: `linear-gradient(90deg, hsl(185 80% 55% / 0.6), hsl(185 80% 55%))`,
              boxShadow: `0 0 12px hsl(185 80% 55% / 0.4)`,
            }}
          />
        </div>
        {/* Tick marks */}
        <div className="mt-1.5 flex justify-between px-0.5">
          {Array.from({ length: max - min + 1 }, (_, i) => (
            <div
              key={i}
              className={`h-1 w-px ${i + min === value ? 'bg-primary' : 'bg-muted-foreground/20'}`}
            />
          ))}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
    </div>
  );
};

export default SliderControl;
