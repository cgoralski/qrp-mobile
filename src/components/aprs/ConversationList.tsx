import { useState, useRef } from "react";
import { MessageSquare, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversations: Conversation[];
  myCallsign: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

const formatTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
};

const DELETE_THRESHOLD = 72; // px — how far to swipe before snap-to-delete

interface SwipeableRowProps {
  conv: Conversation;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const SwipeableRow = ({ conv, onSelect, onDelete }: SwipeableRowProps) => {
  const last = conv.messages[conv.messages.length - 1];
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null);

  const REVEAL_WIDTH = 72; // px of delete button revealed at full swipe

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Determine scroll axis on first significant movement
    if (isHorizontal.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    // Only allow left swipe (negative dx)
    const clamped = Math.max(-REVEAL_WIDTH - 8, Math.min(0, dx));
    setOffsetX(clamped);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    isHorizontal.current = null;
    startX.current = null;
    startY.current = null;

    // Snap to open or closed
    if (offsetX < -(DELETE_THRESHOLD / 2)) {
      setOffsetX(-REVEAL_WIDTH);
    } else {
      setOffsetX(0);
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => onDelete(conv.id), 280);
  };

  const handleTap = () => {
    if (offsetX !== 0) {
      // Close the swipe first
      setOffsetX(0);
      return;
    }
    onSelect(conv.id);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        opacity: isDeleting ? 0 : 1,
        maxHeight: isDeleting ? 0 : "200px",
        transition: isDeleting
          ? "opacity 0.25s ease, max-height 0.28s ease"
          : "none",
      }}
    >
      {/* Delete button (revealed behind the row) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-xl"
        style={{
          width: `${REVEAL_WIDTH}px`,
          background: "linear-gradient(135deg, hsl(0 70% 40%), hsl(0 80% 30%))",
        }}
      >
        <button
          onClick={handleDelete}
          className="flex flex-col items-center gap-0.5 w-full h-full justify-center active:opacity-70"
          aria-label="Delete conversation"
        >
          <Trash2 className="h-4 w-4" style={{ color: "hsl(0 0% 95%)" }} />
          <span
            className="font-mono-display font-bold tracking-wider"
            style={{ fontSize: "8px", color: "hsl(0 0% 90%)" }}
          >
            DELETE
          </span>
        </button>
      </div>

      {/* Row content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
        className="relative flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
          background: "linear-gradient(135deg, hsl(210 18% 13%), hsl(210 18% 10%))",
          border: "1px solid hsl(210 15% 20% / 0.6)",
          borderRadius: "12px",
        }}
      >
        {/* Avatar */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: "40px",
            height: "40px",
            background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.07))",
            border: "1px solid hsl(var(--primary) / 0.2)",
          }}
        >
          <span
            className="font-mono-display font-black"
            style={{ fontSize: "10px", color: "hsl(var(--primary))", letterSpacing: "0.05em" }}
          >
            {conv.callsign.slice(0, 4)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span
              className="font-mono-display font-black tracking-wider"
              style={{ fontSize: "12px", color: "hsl(var(--primary))" }}
            >
              {conv.callsign}
            </span>
            <span className="tab-meta">{formatTime(conv.updatedAt)}</span>
          </div>
          {last && (
            <p className="tab-body truncate" style={{ opacity: 0.55 }}>
              {last.direction === "sent" ? "You: " : ""}{last.text}
            </p>
          )}
        </div>

        <ChevronRight
          className="h-3.5 w-3.5 flex-shrink-0 transition-opacity"
          style={{
            color: "hsl(var(--muted-foreground) / 0.4)",
            opacity: offsetX < -8 ? 0 : 1,
          }}
        />
      </div>
    </div>
  );
};

const ConversationList = ({ conversations, myCallsign, onSelect, onNewChat, onDelete }: ConversationListProps) => {
  const callsignValid = myCallsign.trim().length >= 3;

  return (
    <div className="tab-panel flex flex-1 flex-col w-full max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="tab-section-title">APRS MSG</span>
        </div>
        <button
          onClick={onNewChat}
          className="tab-icon-btn h-8 w-8 active:scale-90 transition-transform"
          style={{
            background: "linear-gradient(180deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.07))",
            border: "1px solid hsl(var(--primary) / 0.25)",
            borderRadius: "8px",
          }}
          aria-label="New chat"
        >
          <Plus className="h-4 w-4 text-primary" />
        </button>
      </div>

      {/* Identity strip */}
      <div
        className="mx-2 mb-1 flex items-center gap-2 rounded-xl px-3 py-2"
        style={{
          background: callsignValid ? "hsl(var(--primary) / 0.07)" : "hsl(0 0% 50% / 0.06)",
          border: `1px solid ${callsignValid ? "hsl(var(--primary) / 0.18)" : "hsl(0 0% 40% / 0.15)"}`,
        }}
      >
        <span className="tab-meta">MY CALL</span>
        <span
          className="font-mono-display font-black tracking-widest"
          style={{
            fontSize: "13px",
            color: callsignValid ? "hsl(var(--primary))" : "hsl(0 0% 40%)",
            textShadow: callsignValid ? "0 0 8px hsl(var(--primary) / 0.45)" : "none",
          }}
        >
          {myCallsign || "NO CALL"}
        </span>
        {!callsignValid && (
          <span className="tab-meta ml-auto" style={{ color: "hsl(0 75% 60%)" }}>
            Set in Settings
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-20" />
            <span className="tab-section-title opacity-40">NO CONVERSATIONS</span>
            <span className="tab-meta opacity-30 text-center px-4">
              Tap <strong>+</strong> to start a new APRS message thread
            </span>
          </div>
        ) : (
          conversations.map((conv) => (
            <SwipeableRow
              key={conv.id}
              conv={conv}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;
