import { useState } from "react";
import { Radio } from "lucide-react";
import FrequencyInput from "@/components/FrequencyInput";
import SliderControl from "@/components/SliderControl";

import PTTButton from "@/components/PTTButton";
import ConnectionStatus from "@/components/ConnectionStatus";

const Index = () => {
  const [frequency, setFrequency] = useState("429.3500");
  const [squelch, setSquelch] = useState(3);
  const [volume, setVolume] = useState(70);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mesh">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <span className="font-mono-display text-sm font-semibold tracking-wider text-foreground">
            RADIO<span className="text-primary text-glow">LINK</span>
          </span>
        </div>
        <ConnectionStatus connected={false} />
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center gap-5 px-4 py-6 sm:justify-center sm:gap-6 max-w-lg mx-auto w-full">
        {/* Frequency Display */}
        <section className="w-full animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <FrequencyInput value={frequency} onChange={setFrequency} />
        </section>

        {/* Volume & Squelch Row */}
        <section className="w-full grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="glass-panel rounded-2xl p-4">
            <SliderControl
              label="Volume"
              value={volume}
              min={0}
              max={100}
              step={5}
              onChange={setVolume}
              unit="%"
            />
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <SliderControl
              label="Squelch"
              value={squelch}
              min={0}
              max={9}
              step={1}
              onChange={setSquelch}
            />
          </div>
        </section>

        {/* PTT Button */}
        <section className="py-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <PTTButton />
        </section>
      </main>
    </div>
  );
};

export default Index;
