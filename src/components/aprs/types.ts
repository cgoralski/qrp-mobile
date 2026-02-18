export interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: Date;
  direction: "sent" | "received";
}

export interface Conversation {
  id: string;
  callsign: string;
  messages: Message[];
  updatedAt: Date;
}
