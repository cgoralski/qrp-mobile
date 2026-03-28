import { useRef, useEffect } from "react";
import { Send, ArrowLeft, AlertTriangle, Trash2 } from "lucide-react";
import type { Conversation } from "./types";

interface ChatViewProps {
  conversation: Conversation;
  myCallsign: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onBack: () => void;
  onDelete: () => void;
  onNavigateToSettings: () => void;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ChatView = ({
  conversation,
  myCallsign,
  draft,
  onDraftChange,
  onSend,
  onBack,
  onDelete,
  onNavigateToSettings,
}: ChatViewProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const callsignValid = myCallsign.trim().length >= 3;

  // Scroll messages to bottom without scrolling the window (prevents page shifting under header on mobile)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation.messages]);

  // Focus input without scrolling the page
  useEffect(() => {
    if (callsignValid) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [callsignValid]);

  return (
    <div
      className="tab-panel flex flex-col w-full max-w-lg mx-auto overflow-hidden"
      style={{ animation: "slideInRight 0.25s cubic-bezier(0.32,0.72,0,1) both", height: "100%", marginTop: 0 }}
    >
      {/* Header */}
      <div className="tab-header flex items-center gap-2 px-2 py-2.5">
        <button
          onClick={onBack}
          className="tab-icon-btn h-8 w-8 flex-shrink-0 active:scale-90 transition-transform"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            border: "1px solid hsl(var(--primary) / 0.18)",
            borderRadius: "8px",
          }}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
        </button>

        {/* Callsign badge */}
        <div className="flex-1 flex flex-col min-w-0">
          <span className="tab-callsign tab-callsign-primary text-glow" style={{ fontSize: "16px" }}>
            {conversation.callsign}
          </span>
          <span className="tab-meta" style={{ lineHeight: 1 }}>
            FROM:{" "}
            <span style={{ color: callsignValid ? "hsl(0 0% 75%)" : "hsl(0 75% 60%)" }}>
              {myCallsign || "NO CALL"}
            </span>
          </span>
        </div>

        {/* Delete conversation */}
        <button
          onClick={onDelete}
          className="tab-icon-btn h-8 w-8 flex-shrink-0 active:scale-90 transition-transform"
          style={{
            background: "hsl(0 72% 40% / 0.15)",
            border: "1px solid hsl(0 72% 40% / 0.35)",
            borderRadius: "8px",
          }}
          aria-label="Delete conversation"
        >
          <Trash2 className="h-4 w-4" style={{ color: "hsl(0 72% 55%)" }} />
        </button>
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
            No callsign set — tap here to open Settings.
          </span>
        </div>
      )}

      {/* Messages — ref so we scroll only this container, never the document */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0"
      >
        {conversation.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
            <Send className="h-7 w-7 mb-2 opacity-20" />
            <span className="tab-meta opacity-40 text-center">
              Start the conversation with {conversation.callsign}
            </span>
          </div>
        )}
        {conversation.messages.map((msg) => (
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
                    ? "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.07))"
                    : "linear-gradient(135deg, hsl(210 18% 14%), hsl(210 18% 10%))",
                border: `1px solid ${
                  msg.direction === "sent"
                    ? "hsl(var(--primary) / 0.22)"
                    : "hsl(210 15% 22% / 0.5)"
                }`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`tab-callsign ${msg.direction === "sent" ? "tab-callsign-primary" : ""}`}
                  style={msg.direction !== "sent" ? { color: "hsl(0 0% 55%)" } : undefined}
                >
                  {msg.from}
                </span>
                <span className="tab-meta">{formatTime(msg.timestamp)}</span>
              </div>
              <p className="tab-body">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <div className="flex items-center gap-2 px-2 py-2 border-t border-border/40">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder={callsignValid ? "Type APRS message…" : "Set callsign in Settings…"}
          disabled={!callsignValid}
          className="tab-input flex-1 disabled:opacity-40"
          maxLength={67}
        />
        <button
          onClick={onSend}
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

export default ChatView;
