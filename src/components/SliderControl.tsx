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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="font-mono-display text-sm font-medium text-primary">
          {value}
          {unit}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ position: "relative" }}
        aria-label={label}
      />
    </div>
  );
};

export default SliderControl;
