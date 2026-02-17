interface FilterControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const FilterControl = ({ label, value, onChange }: FilterControlProps) => {
  const percentage = ((value + 12) / 24) * 100; // range -12 to +12

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="relative flex h-28 w-3 items-center justify-center rounded-full bg-secondary sm:h-32">
        {/* Center line */}
        <div className="absolute top-1/2 h-px w-full bg-muted-foreground/30" />
        {/* Fill */}
        <div
          className="absolute bottom-0 w-full rounded-full bg-primary transition-all duration-75"
          style={{
            height: `${percentage}%`,
            opacity: 0.7,
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
          style={{
            writingMode: "vertical-lr" as any,
            direction: "rtl",
          }}
          aria-label={`${label} filter`}
        />
      </div>
      <span className="font-mono-display text-xs font-medium text-primary">
        {value > 0 ? `+${value}` : value}
        <span className="text-muted-foreground">dB</span>
      </span>
    </div>
  );
};

export default FilterControl;
