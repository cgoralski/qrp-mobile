import { useState } from "react";
import ConversationList from "./aprs/ConversationList";
import ChatView from "./aprs/ChatView";
import NewChatModal from "./aprs/NewChatModal";
import type { Conversation, Message } from "./aprs/types";

/* ── Seed demo data ── */
const seedConversations = (): Conversation[] => [
  {
    id: "conv-1",
    callsign: "KD7ABC",
    updatedAt: new Date(Date.now() - 3400000),
    messages: [
      {
        id: "m1",
        from: "KD7ABC",
        to: "KE7XYZ",
        text: "Good morning, heading to the repeater site.",
        timestamp: new Date(Date.now() - 3600000),
        direction: "received",
      },
      {
        id: "m2",
        from: "KE7XYZ",
        to: "KD7ABC",
        text: "Copy that. ETA?",
        timestamp: new Date(Date.now() - 3500000),
        direction: "sent",
      },
      {
        id: "m3",
        from: "KD7ABC",
        to: "KE7XYZ",
        text: "About 20 minutes. Will check in on 146.520.",
        timestamp: new Date(Date.now() - 3400000),
        direction: "received",
      },
    ],
  },
  {
    id: "conv-2",
    callsign: "VK2XYZ",
    updatedAt: new Date(Date.now() - 86400000),
    messages: [
      {
        id: "m4",
        from: "VK2XYZ",
        to: "KE7XYZ",
        text: "73! Great signal tonight.",
        timestamp: new Date(Date.now() - 86400000),
        direction: "received",
      },
    ],
  },
];

interface APRSMessagingProps {
  myCallsign: string;
  onNavigateToSettings: () => void;
}

const APRSMessaging = ({ myCallsign, onNavigateToSettings }: APRSMessagingProps) => {
  const [conversations, setConversations] = useState<Conversation[]>(seedConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [draft, setDraft] = useState("");

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const handleSelect = (id: string) => {
    setDraft("");
    setActiveConvId(id);
  };

  const handleBack = () => {
    setActiveConvId(null);
    setDraft("");
  };

  const handleSend = () => {
    if (!draft.trim() || !activeConvId || myCallsign.trim().length < 3) return;
    const msg: Message = {
      id: Date.now().toString(),
      from: myCallsign,
      to: activeConv!.callsign,
      text: draft.trim(),
      timestamp: new Date(),
      direction: "sent",
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: [...c.messages, msg], updatedAt: new Date() }
          : c
      )
    );
    setDraft("");
  };

  const handleNewChat = (callsign: string) => {
    // Reuse existing conversation if one exists for this callsign
    const existing = conversations.find((c) => c.callsign === callsign);
    if (existing) {
      setShowNewChat(false);
      setActiveConvId(existing.id);
      return;
    }
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      callsign,
      messages: [],
      updatedAt: new Date(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setShowNewChat(false);
    setActiveConvId(newConv.id);
  };

  return (
    <>
      {/* Sliding views */}
      <div className="flex flex-1 flex-col w-full overflow-hidden relative">
        {activeConv ? (
          <ChatView
            key={activeConv.id}
            conversation={activeConv}
            myCallsign={myCallsign}
            draft={draft}
            onDraftChange={setDraft}
            onSend={handleSend}
            onBack={handleBack}
            onNavigateToSettings={onNavigateToSettings}
          />
        ) : (
          <ConversationList
            conversations={[...conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())}
            myCallsign={myCallsign}
            onSelect={handleSelect}
            onNewChat={() => setShowNewChat(true)}
            onDelete={(id) => setConversations((prev) => prev.filter((c) => c.id !== id))}
          />
        )}
      </div>

      {/* New chat bottom sheet */}
      {showNewChat && (
        <NewChatModal onStart={handleNewChat} onClose={() => setShowNewChat(false)} />
      )}
    </>
  );
};

export default APRSMessaging;
