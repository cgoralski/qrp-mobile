import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare } from "lucide-react";

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

const APRSMessaging = () => {
  const [messages, setMessages] = useState<Message[]>(demoMessages);
  const [draft, setDraft] = useState("");
  const [callsign, setCallsign] = useState("KE7XYZ");
  const [targetCall, setTargetCall] = useState("KD7ABC");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim()) return;
    const msg: Message = {
      id: Date.now().toString(),
      from: callsign,
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
    <div className="flex flex-1 flex-col w-full max-w-lg mx-auto">
      {/* APRS Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl mb-2"
        style={{
          background: "linear-gradient(180deg, hsl(210 25% 5%), hsl(210 20% 8%))",
          border: "1px solid hsl(210 15% 18% / 0.6)",
          boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.04), 0 4px 16px hsl(220 30% 3% / 0.4)",
        }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-mono-display text-xs font-bold tracking-wider text-primary">
            APRS MSG
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="font-mono-display text-[8px] text-muted-foreground tracking-wider">MY CALL</span>
            <input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value.toUpperCase())}
              className="font-mono-display text-[11px] font-bold text-foreground bg-transparent text-right w-16 outline-none"
              maxLength={7}
            />
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div className="flex flex-col items-end">
            <span className="font-mono-display text-[8px] text-muted-foreground tracking-wider">TO</span>
            <input
              value={targetCall}
              onChange={(e) => setTargetCall(e.target.value.toUpperCase())}
              className="font-mono-display text-[11px] font-bold text-amber-400 bg-transparent text-right w-16 outline-none"
              maxLength={7}
            />
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-1 space-y-2 min-h-0"
        style={{ maxHeight: "calc(100dvh - 240px)" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <span className="font-mono-display text-xs tracking-wider">NO MESSAGES</span>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.direction === "sent" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.direction === "sent"
                  ? "rounded-br-sm"
                  : "rounded-bl-sm"
              }`}
              style={{
                background:
                  msg.direction === "sent"
                    ? "linear-gradient(135deg, hsl(185 80% 55% / 0.15), hsl(185 80% 55% / 0.05))"
                    : "linear-gradient(135deg, hsl(210 18% 14%), hsl(210 18% 10%))",
                border: `1px solid ${
                  msg.direction === "sent"
                    ? "hsl(185 80% 55% / 0.2)"
                    : "hsl(210 15% 22% / 0.5)"
                }`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`font-mono-display text-[9px] font-bold tracking-wider ${
                    msg.direction === "sent" ? "text-primary" : "text-amber-400"
                  }`}
                >
                  {msg.from}
                </span>
                <span className="font-mono-display text-[8px] text-muted-foreground">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-sm text-foreground leading-snug">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose bar */}
      <div className="flex items-center gap-2 mt-2 px-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type APRS message..."
          className="flex-1 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono-display"
          style={{
            background: "linear-gradient(180deg, hsl(210 18% 12%), hsl(210 18% 9%))",
            border: "1px solid hsl(210 15% 20% / 0.5)",
          }}
          maxLength={67}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-30"
          style={{
            background: "linear-gradient(180deg, hsl(185 80% 55% / 0.2), hsl(185 80% 55% / 0.08))",
            border: "1px solid hsl(185 80% 55% / 0.25)",
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
