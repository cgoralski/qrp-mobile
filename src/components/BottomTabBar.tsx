import { Mic, MessageSquare, Settings } from "lucide-react";

interface BottomTabBarProps {
  activeTab: "voice" | "aprs" | "settings";
  onTabChange: (tab: "voice" | "aprs" | "settings") => void;
}

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const tabs = [
    { id: "voice" as const, label: "Voice", icon: Mic },
    { id: "aprs" as const, label: "APRS", icon: MessageSquare },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <nav
      className="sticky bottom-0 z-50 flex items-stretch"
      style={{
        background: "linear-gradient(180deg, hsl(210 20% 8% / 0.85), hsl(210 20% 6% / 0.95))",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderTop: "1px solid hsl(210 15% 18% / 0.4)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {isActive && (
                <div
                  className="absolute -bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 6px hsl(185 80% 55% / 0.5)" }}
                />
              )}
            </div>
            <span className="font-mono-display text-[9px] font-semibold tracking-[0.15em]">
              {tab.label.toUpperCase()}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomTabBar;
