import { useState } from "react";
import { Radio } from "lucide-react";
import FrequencyInput from "@/components/FrequencyInput";
import PTTButton from "@/components/PTTButton";
import ConnectionStatus from "@/components/ConnectionStatus";

const Index = () => {
  const [frequency, setFrequency] = useState("429.3500");

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
      <main className="flex flex-1 flex-col items-center px-4 py-6 max-w-lg mx-auto w-full">
        {/* Frequency Display */}
        <section className="w-full animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <FrequencyInput value={frequency} onChange={setFrequency} />
        </section>

        {/* Spacer to push PTT to bottom */}
        <div className="flex-1" />

        {/* PTT Button */}
        <section className="pb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <PTTButton />
        </section>
      </main>
    </div>
  );
};

export default Index;
