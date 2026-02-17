import { useState } from "react";
import { Radio } from "lucide-react";
import FrequencyInput from "@/components/FrequencyInput";
import SliderControl from "@/components/SliderControl";
import FilterControl from "@/components/FilterControl";
import PTTButton from "@/components/PTTButton";
import ConnectionStatus from "@/components/ConnectionStatus";

const Index = () => {
  const [frequency, setFrequency] = useState("429.3500");
  const [squelch, setSquelch] = useState(3);
  const [filterLow, setFilterLow] = useState(0);
  const [filterMid, setFilterMid] = useState(0);
  const [filterHigh, setFilterHigh] = useState(0);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <span className="font-mono-display text-sm font-semibold tracking-wider text-foreground">
            RADIO<span className="text-primary">LINK</span>
          </span>
        </div>
        <ConnectionStatus connected={false} />
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-between gap-6 px-4 py-6 sm:justify-center sm:gap-8">
        {/* Frequency Display */}
        <section className="w-full max-w-md">
          <FrequencyInput value={frequency} onChange={setFrequency} />
        </section>

        {/* Controls Grid */}
        <section className="w-full max-w-md space-y-6">
          {/* Squelch */}
          <div className="panel-inset rounded-xl border border-border p-4">
            <SliderControl
              label="Squelch"
              value={squelch}
              min={0}
              max={9}
              step={1}
              onChange={setSquelch}
            />
          </div>

          {/* Audio Filters */}
          <div className="panel-inset rounded-xl border border-border p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              Audio EQ
            </p>
            <div className="flex items-end justify-center gap-8">
              <FilterControl label="Low" value={filterLow} onChange={setFilterLow} />
              <FilterControl label="Mid" value={filterMid} onChange={setFilterMid} />
              <FilterControl label="High" value={filterHigh} onChange={setFilterHigh} />
            </div>
          </div>
        </section>

        {/* PTT Button */}
        <section className="pb-4">
          <PTTButton />
        </section>
      </main>
    </div>
  );
};

export default Index;
