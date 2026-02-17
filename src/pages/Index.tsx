import { useState, useCallback } from "react";
import { Radio, Settings } from "lucide-react";
import RadioScreen from "@/components/RadioScreen";
import NumPad from "@/components/NumPad";
import PTTButton from "@/components/PTTButton";
import ConnectionStatus from "@/components/ConnectionStatus";
import BottomTabBar from "@/components/BottomTabBar";
import APRSMessaging from "@/components/APRSMessaging";

const Index = () => {
  const [channelA, setChannelA] = useState("027.00000");
  const [channelB, setChannelB] = useState("435.00000");
  const [activeChannel, setActiveChannel] = useState<"A" | "B">("A");
  const [inputBuffer, setInputBuffer] = useState("");
  const [activeTab, setActiveTab] = useState<"voice" | "aprs" | "settings">("voice");

  const setActiveFreq = activeChannel === "A" ? setChannelA : setChannelB;

  const handleDigit = useCallback(
    (digit: string) => {
      if (digit === "*" || digit === "#") return;
      const next = inputBuffer + digit;
      if (next.length <= 8) {
        setInputBuffer(next);
        const raw = next.length > 3 ? next.slice(0, 3) + "." + next.slice(3) : next;
        setActiveFreq(raw);
      }
    },
    [inputBuffer, setActiveFreq]
  );

  const handleBackspace = useCallback(() => {
    const next = inputBuffer.slice(0, -1);
    setInputBuffer(next);
    if (next.length === 0) {
      setActiveFreq("000.00000");
    } else {
      const raw = next.length > 3 ? next.slice(0, 3) + "." + next.slice(3) : next;
      setActiveFreq(raw);
    }
  }, [inputBuffer, setActiveFreq]);

  const handleEnter = useCallback(() => {
    setInputBuffer("");
  }, []);

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
      <main className="flex flex-1 flex-col items-center px-4 py-4 max-w-sm mx-auto w-full gap-4">
        {activeTab === "voice" ? (
          <>
            {/* Radio Screen */}
            <section className="w-full animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <RadioScreen
                channelA={channelA}
                channelB={channelB}
                onChannelAChange={setChannelA}
                onChannelBChange={setChannelB}
                activeChannel={activeChannel}
                onActiveChannelChange={setActiveChannel}
                rssi={5}
              />
            </section>

            {/* Numeric Keypad */}
            <section className="w-full animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <NumPad
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onEnter={handleEnter}
              />
            </section>

            {/* Spacer */}
            <div className="flex-1" />

            {/* PTT Button */}
            <section className="pb-2 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <PTTButton />
            </section>
          </>
        ) : activeTab === "aprs" ? (
          <APRSMessaging />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3">
            <Settings className="h-8 w-8 opacity-30" />
            <span className="font-mono-display text-xs tracking-wider">SETTINGS</span>
            <span className="text-[11px] text-muted-foreground/60">Coming soon</span>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
