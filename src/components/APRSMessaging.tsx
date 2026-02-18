import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, AlertTriangle } from "lucide-react";

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: Date;
  direction: "sent" | "received";
}

const demoMessages: Message[] = [
  {
    id: "1",
    from: "KD7ABC",
    to: "KE7XYZ",
    text: "Good morning, heading to the repeater site.",
    timestamp: new Date(Date.now() - 3600000),
    direction: "received",
  },
  {
    id: "2",
    from: "KE7XYZ",
    to: "KD7ABC",
    text: "Copy that. ETA?",
    timestamp: new Date(Date.now() - 3500000),
    direction: "sent",
  },
  {
    id: "3",
    from: "KD7ABC",
    to: "KE7XYZ",
    text: "About 20 minutes. Will check in on 146.520.",
    timestamp: new Date(Date.now() - 3400000),
    direction: "received",
  },
];

interface APRSMessagingProps {
  myCallsign: string;
  onNavigateToSettings: () => void;
}

const APRSMessaging = ({ myCallsign, onNavigateToSettings }: APRSMessagingProps) => {
  const [messages, setMessages] = useState<Message[]>(demoMessages);
  const [draft, setDraft] = useState("");
  const [targetCall, setTargetCall] = useState("KD7ABC");
  const bottomRef = useRef<HTMLDivElement>(null);
  const callsignValid = myCallsign.trim().length >= 3;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim() || !callsignValid) return;
    const msg: Message = {
      id: Date.now().toString(),
      from: myCallsign,
      to: targetCall,
      text: draft.trim(),
      timestamp: new Date(),
      direction: "sent",
    };
    setMessages((prev) => [...prev, msg]);
    setDraft("");
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="tab-panel flex flex-1 flex-col w-full max-w-lg mx-auto">
      {/* Header bar */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="tab-section-title">APRS MSG</span>
        </div>
        <div className="flex items-center gap-3">
          {/* MY CALL identity badge */}
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
            style={{
              background: callsignValid
                ? "hsl(var(--primary) / 0.12)"
                : "hsl(0 0% 50% / 0.08)",
              border: `1px solid ${callsignValid ? "hsl(var(--primary) / 0.25)" : "hsl(0 0% 40% / 0.2)"}`,
            }}
          >
            <span className="tab-meta" style={{ lineHeight: 1 }}>FROM</span>
            <span
              className="font-mono-display font-black tracking-widest"
              style={{
                fontSize: "13px",
                lineHeight: 1,
                color: callsignValid ? "hsl(var(--primary))" : "hsl(0 0% 45%)",
                textShadow: callsignValid ? "0 0 8px hsl(var(--primary) / 0.5)" : "none",
              }}
            >
              {myCallsign || "NO CALL"}
            </span>
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div className="flex flex-col items-end">
            <span className="tab-meta">TO</span>
            <input
              value={targetCall}
              onChange={(e) => setTargetCall(e.target.value.toUpperCase())}
              className="tab-callsign bg-transparent text-right w-16 outline-none"
              style={{ padding: 0, border: "none", borderRadius: 0, width: "4rem", fontSize: "11px" }}
              maxLength={7}
            />
          </div>
        </div>
      </div>

      {/* No callsign warning */}
      {!callsignValid && (
        <div
          className="mx-2 mt-1 flex items-start gap-2 rounded-xl px-3 py-2.5 cursor-pointer"
          style={{ background: "hsl(0 80% 55% / 0.08)", border: "1px solid hsl(0 80% 55% / 0.25)" }}
          onClick={onNavigateToSettings}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(0 80% 65%)" }} />
          <span className="tab-meta leading-relaxed" style={{ color: "hsl(0 80% 65%)" }}>
            No callsign set — APRS messaging is disabled. Tap here to open Settings and enter your callsign.
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0"
        style={{ maxHeight: "calc(100dvh - 240px)" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <span className="tab-section-title opacity-40">NO MESSAGES</span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.direction === "sent" ? "items-end" : "items-start"}`}
          >
            <div
              className={`tab-card max-w-[80%] px-3 py-2 ${
                msg.direction === "sent" ? "rounded-br-sm" : "rounded-bl-sm"
              }`}
              style={{
                background:
                  msg.direction === "sent"
                    ? "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))"
                    : "linear-gradient(135deg, hsl(210 18% 14%), hsl(210 18% 10%))",
                border: `1px solid ${
                  msg.direction === "sent"
                    ? "hsl(var(--primary) / 0.2)"
                    : "hsl(210 15% 22% / 0.5)"
                }`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`tab-callsign ${msg.direction === "sent" ? "tab-callsign-primary" : ""}`}>
                  {msg.from}
                </span>
                <span className="tab-meta">{formatTime(msg.timestamp)}</span>
              </div>
              <p className="tab-body">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose bar */}
      <div className="flex items-center gap-2 px-2 py-2 border-t border-border/40">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={callsignValid ? "Type APRS message…" : "Set callsign in Settings to send…"}
          disabled={!callsignValid}
          className="tab-input flex-1 disabled:opacity-40"
          maxLength={67}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || !callsignValid}
          className="tab-icon-btn h-10 w-10 disabled:opacity-30 active:scale-95"
          style={{
            background: "linear-gradient(180deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))",
            border: "1px solid hsl(var(--primary) / 0.25)",
          }}
          aria-label="Send message"
        >
          <Send className="h-4 w-4 text-primary" />
        </button>
      </div>
    </div>
  );
};

export default APRSMessaging;
