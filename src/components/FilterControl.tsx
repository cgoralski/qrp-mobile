interface FilterControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const FilterControl = ({ label, value, onChange }: FilterControlProps) => {
  const percentage = ((value + 12) / 24) * 100;
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div className="flex flex-1 flex-col items-center gap-2.5">
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
        {label}
      </span>
      <div className="relative flex h-32 w-4 items-center justify-center rounded-full bg-secondary/60 sm:h-36">
        {/* Center notch */}
        <div className="absolute top-1/2 -translate-y-px h-[2px] w-full rounded-full bg-muted-foreground/30" />
        {/* Fill bar */}
        {!isNeutral && (
          <div
            className="absolute w-full rounded-full transition-all duration-100"
            style={{
              background: `linear-gradient(${isPositive ? '0deg' : '180deg'}, hsl(185 80% 55%), hsl(185 80% 55% / 0.3))`,
              boxShadow: `0 0 10px hsl(185 80% 55% / 0.3)`,
              ...(isPositive
                ? { bottom: '50%', height: `${(value / 12) * 50}%` }
                : { top: '50%', height: `${(Math.abs(value) / 12) * 50}%` }
              ),
            }}
          />
        )}
        {/* Thumb indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-primary bg-background shadow-lg transition-all duration-100"
          style={{
            bottom: `calc(${percentage}% - 6px)`,
            boxShadow: `0 0 8px hsl(185 80% 55% / 0.3)`,
          }}
        />
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute h-full w-full cursor-pointer opacity-0"
          style={{ writingMode: "vertical-lr" as any, direction: "rtl" }}
          aria-label={`${label} filter`}
        />
      </div>
      <span className="font-mono-display text-xs font-semibold text-primary">
        {value > 0 ? `+${value}` : value}
        <span className="text-muted-foreground/60 ml-0.5">dB</span>
      </span>
    </div>
  );
};

export default FilterControl;
