import { MessageSquare, ChevronRight, Plus } from "lucide-react";
import SwipeToDelete from "@/components/ui/SwipeToDelete";
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

const ConversationList = ({
  conversations,
  myCallsign,
  onSelect,
  onNewChat,
  onDelete,
}: ConversationListProps) => {
  const callsignValid = myCallsign.trim().length >= 3;

  return (
    <div className="tab-panel flex flex-1 flex-col w-full max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {callsignValid ? (
            <span
              className="font-mono-display font-black tracking-[0.18em]"
              style={{
                fontSize: "13px",
                color: "hsl(0 0% 98%)",
                textShadow:
                  "0 0 4px hsl(200 80% 90% / 0.5), 0 0 12px hsl(200 70% 80% / 0.25)",
              }}
            >
              {myCallsign}
            </span>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="tab-section-title">APRS MSG</span>
            </>
          )}
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
          conversations.map((conv) => {
            const last = conv.messages[conv.messages.length - 1];
            return (
              <SwipeToDelete
                key={conv.id}
                onTap={() => onSelect(conv.id)}
                onDelete={() => onDelete(conv.id)}
                className="rounded-xl"
              >
                {/* Row content */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 select-none rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, hsl(210 18% 13%), hsl(210 18% 10%))",
                    border: "1px solid hsl(210 15% 20% / 0.6)",
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
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: "hsl(var(--muted-foreground) / 0.4)" }}
                  />
                </div>
              </SwipeToDelete>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
