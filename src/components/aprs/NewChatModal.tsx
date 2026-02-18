import { useState } from "react";
import { X, Radio } from "lucide-react";

interface NewChatModalProps {
  onStart: (callsign: string) => void;
  onClose: () => void;
}

const NewChatModal = ({ onStart, onClose }: NewChatModalProps) => {
  const [value, setValue] = useState("");

  const handleStart = () => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 8);
    if (cleaned.length < 3) return;
    onStart(cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "hsl(210 30% 2% / 0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-auto rounded-t-2xl px-4 pt-4 pb-8 animate-fade-in"
        style={{
          background: "linear-gradient(180deg, hsl(210 20% 12%), hsl(210 20% 9%))",
          border: "1px solid hsl(210 15% 22% / 0.6)",
          borderBottom: "none",
          boxShadow: "0 -16px 48px hsl(210 30% 2% / 0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="rounded-full" style={{ width: "32px", height: "3px", background: "hsl(210 15% 28%)" }} />
        </div>

        {/* Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span className="tab-section-title">NEW CONVERSATION</span>
          </div>
          <button onClick={onClose} className="tab-icon-btn h-7 w-7 active:scale-90" aria-label="Close">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <p className="tab-meta mb-3 leading-relaxed">
          Enter the callsign of the station you want to message:
        </p>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 8))}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
          placeholder="e.g. KD7ABC"
          className="tab-input w-full mb-3 font-mono-display tracking-widest"
          style={{ fontSize: "16px", textAlign: "center" }}
          autoFocus
          maxLength={8}
        />

        <button
          onClick={handleStart}
          disabled={value.replace(/[^A-Z0-9/]/g, "").length < 3}
          className="w-full py-2.5 rounded-xl font-mono-display font-bold tracking-widest text-sm transition-all disabled:opacity-30 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.12))",
            border: "1px solid hsl(var(--primary) / 0.3)",
            color: "hsl(var(--primary))",
            textShadow: "0 0 8px hsl(var(--primary) / 0.4)",
          }}
        >
          START CHAT
        </button>
      </div>
    </div>
  );
};

export default NewChatModal;
