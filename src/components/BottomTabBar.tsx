import { useState } from "react";
import { Mic, MessageSquare, Settings, BookUser, Radio, Map, ChevronUp, ChevronDown } from "lucide-react";

export type TabId = "voice" | "aprs" | "contacts" | "scanner" | "map" | "settings";

interface BottomTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const ALL_TABS = [
  { id: "voice" as TabId,    label: "Voice",    icon: Mic },
  { id: "aprs" as TabId,     label: "APRS",     icon: MessageSquare },
  { id: "contacts" as TabId, label: "Contacts", icon: BookUser },
  { id: "scanner" as TabId,  label: "Scanner",  icon: Radio },
  { id: "map" as TabId,      label: "Map",      icon: Map },
  { id: "settings" as TabId, label: "Settings", icon: Settings },
];

const BottomTabBar = ({ activeTab, onTabChange }: BottomTabBarProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (tab: TabId) => {
    onTabChange(tab);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-up drawer */}
      <div
        className="fixed left-0 right-0 z-50 transition-transform duration-300 ease-in-out"
        style={{
          bottom: "48px", // sit just above the bar
          transform: drawerOpen ? "translateY(0)" : "translateY(110%)",
          background: "linear-gradient(180deg, hsl(210 20% 9% / 0.97), hsl(210 20% 7% / 0.99))",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          borderTop: "1px solid hsl(210 15% 20% / 0.5)",
          borderRadius: "16px 16px 0 0",
          boxShadow: "0 -24px 60px hsl(210 30% 2% / 0.95), 0 -4px 16px hsl(210 30% 2% / 0.7), 0 -2px 8px hsl(185 80% 55% / 0.12), inset 0 1px 0 hsl(210 15% 35% / 0.5)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div
            className="rounded-full"
            style={{ width: "32px", height: "3px", background: "hsl(210 15% 28%)" }}
          />
        </div>

        {/* 2×3 grid */}
        <div className="grid grid-cols-3 gap-px px-4 pb-4 pt-2">
          {ALL_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelect(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5"
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
                <span className="font-mono-display text-[9px] font-semibold tracking-[0.12em]">
                  {tab.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slim persistent bottom bar */}
      <nav
        className="sticky bottom-0 z-50 flex items-center justify-center"
        style={{
          height: "48px",
          background: "linear-gradient(180deg, hsl(210 20% 8% / 0.88), hsl(210 20% 6% / 0.96))",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          borderTop: "1px solid hsl(210 15% 18% / 0.4)",
        }}
      >
        {/* Toggle drawer button — centered */}
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex items-center justify-center rounded-full transition-all text-muted-foreground hover:text-primary"
          style={{ width: "40px", height: "40px" }}
          aria-label="Open navigation"
        >
          {drawerOpen ? (
            <ChevronDown className="h-5 w-5 transition-transform duration-300" />
          ) : (
            <ChevronUp className="h-5 w-5 transition-transform duration-300" />
          )}
        </button>
      </nav>
    </>
  );
};

export default BottomTabBar;
