import { useState, useMemo } from "react";
import { Search, Radio, UserPlus, X, Check, ChevronRight } from "lucide-react";

interface Contact {
  id: string;
  callsign: string;
  name: string;
  frequency: string;
  group?: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: "1",  callsign: "W1AW",   name: "ARRL HQ",         frequency: "145.15000", group: "REPEATERS" },
  { id: "2",  callsign: "KD9VXR", name: "Sarah Mitchell",  frequency: "146.52000", group: "LOCAL" },
  { id: "3",  callsign: "VE3TKI", name: "Toronto Net",     frequency: "147.12000", group: "REPEATERS" },
  { id: "4",  callsign: "N5TW",   name: "Tom Walters",     frequency: "446.00000", group: "LOCAL" },
  { id: "5",  callsign: "G4ABC",  name: "UK Relay",        frequency: "145.50000", group: "DX" },
  { id: "6",  callsign: "K7LFR",  name: "Larry Freeman",   frequency: "144.39000", group: "APRS" },
  { id: "7",  callsign: "ZL2BCB", name: "New Zealand DX",  frequency: "14.225000", group: "DX" },
  { id: "8",  callsign: "WB8WKQ", name: "EmComm Group",    frequency: "147.33000", group: "EMCOMM" },
  { id: "9",  callsign: "KG5YZP", name: "James Owens",     frequency: "462.55000", group: "LOCAL" },
  { id: "10", callsign: "VK4BXG", name: "Brisbane Net",    frequency: "146.80000", group: "DX" },
  { id: "11", callsign: "AA1ON",  name: "EOC Primary",     frequency: "155.34000", group: "EMCOMM" },
  { id: "12", callsign: "KJ4QLP", name: "Rachel Torres",   frequency: "446.52500", group: "LOCAL" },
];

const GROUP_COLORS: Record<string, string> = {
  REPEATERS: "hsl(185 80% 55%)",
  LOCAL:     "hsl(142 70% 50%)",
  DX:        "hsl(270 70% 65%)",
  APRS:      "hsl(45 90% 55%)",
  EMCOMM:    "hsl(0 85% 60%)",
};

interface ContactsScreenProps {
  onTuneChannel: (frequency: string) => void;
  activeChannel: "A" | "B";
}

const ContactsScreen = ({ onTuneChannel, activeChannel }: ContactsScreenProps) => {
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [tunedId, setTunedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ callsign: "", name: "", frequency: "", group: "LOCAL" });

  const groups = useMemo(() => Array.from(new Set(contacts.map((c) => c.group).filter(Boolean))) as string[], [contacts]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return contacts.filter((c) => {
      const matchesQuery =
        !q ||
        c.callsign.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.frequency.includes(q);
      const matchesGroup = !selectedGroup || c.group === selectedGroup;
      return matchesQuery && matchesGroup;
    });
  }, [contacts, query, selectedGroup]);

  const handleTune = (contact: Contact) => {
    onTuneChannel(contact.frequency);
    setTunedId(contact.id);
    setTimeout(() => setTunedId(null), 1500);
  };

  const handleAdd = () => {
    if (!newContact.callsign.trim() || !newContact.frequency.trim()) return;
    const id = String(Date.now());
    setContacts((prev) => [
      { ...newContact, id, callsign: newContact.callsign.toUpperCase() },
      ...prev,
    ]);
    setNewContact({ callsign: "", name: "", frequency: "", group: "LOCAL" });
    setShowAdd(false);
  };

  return (
    <div
      className="flex flex-col w-full h-full animate-fade-in"
      style={{
        background: "linear-gradient(175deg, hsl(220 12% 11%) 0%, hsl(220 10% 8%) 100%)",
        border: "1px solid hsl(220 10% 18%)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: "1px solid hsl(215 10% 15%)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono-display text-[10px] font-bold tracking-[0.18em] text-primary">
            CONTACTS
          </span>
          <span
            className="font-mono-display text-[9px] px-1.5 py-0.5 rounded"
            style={{
              background: "hsl(185 80% 55% / 0.12)",
              color: "hsl(185 80% 55%)",
              border: "1px solid hsl(185 80% 55% / 0.25)",
            }}
          >
            {contacts.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="font-mono-display text-[8px] tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: "hsl(185 80% 55% / 0.1)",
              color: "hsl(185 80% 55% / 0.7)",
              border: "1px solid hsl(185 80% 55% / 0.2)",
            }}
          >
            CH {activeChannel}
          </span>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center justify-center rounded-md transition-all"
            style={{
              width: "26px",
              height: "26px",
              background: showAdd ? "hsl(185 80% 55% / 0.2)" : "hsl(215 12% 18%)",
              border: `1px solid ${showAdd ? "hsl(185 80% 55% / 0.4)" : "hsl(215 10% 24%)"}`,
              color: showAdd ? "hsl(185 80% 55%)" : "hsl(215 15% 55%)",
            }}
            aria-label="Add contact"
          >
            {showAdd ? <X className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Add contact form */}
      {showAdd && (
        <div
          className="px-3 py-2.5 flex flex-col gap-2"
          style={{ borderBottom: "1px solid hsl(215 10% 15%)", background: "hsl(215 12% 10%)" }}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              placeholder="CALLSIGN"
              value={newContact.callsign}
              onChange={(e) => setNewContact((p) => ({ ...p, callsign: e.target.value.toUpperCase() }))}
              className="font-mono-display text-[10px] tracking-wider uppercase rounded-md px-2 py-1.5 outline-none w-full"
              style={{
                background: "hsl(215 14% 14%)",
                border: "1px solid hsl(215 10% 22%)",
                color: "hsl(185 80% 65%)",
                caretColor: "hsl(185 80% 55%)",
              }}
            />
            <input
              type="text"
              placeholder="FREQUENCY"
              value={newContact.frequency}
              onChange={(e) => setNewContact((p) => ({ ...p, frequency: e.target.value }))}
              className="font-mono-display text-[10px] tracking-wider rounded-md px-2 py-1.5 outline-none w-full"
              style={{
                background: "hsl(215 14% 14%)",
                border: "1px solid hsl(215 10% 22%)",
                color: "hsl(200 20% 80%)",
                caretColor: "hsl(185 80% 55%)",
              }}
            />
          </div>
          <input
            type="text"
            placeholder="Name"
            value={newContact.name}
            onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
            className="font-mono-display text-[10px] tracking-wider rounded-md px-2 py-1.5 outline-none w-full"
            style={{
              background: "hsl(215 14% 14%)",
              border: "1px solid hsl(215 10% 22%)",
              color: "hsl(200 20% 80%)",
              caretColor: "hsl(185 80% 55%)",
            }}
          />
          <div className="flex gap-1.5">
            {["LOCAL", "REPEATERS", "DX", "APRS", "EMCOMM"].map((g) => (
              <button
                key={g}
                onClick={() => setNewContact((p) => ({ ...p, group: g }))}
                className="font-mono-display text-[8px] tracking-wider px-1.5 py-0.5 rounded transition-all"
                style={{
                  background: newContact.group === g ? `${GROUP_COLORS[g]}22` : "hsl(215 14% 16%)",
                  border: `1px solid ${newContact.group === g ? GROUP_COLORS[g] : "hsl(215 10% 22%)"}`,
                  color: newContact.group === g ? GROUP_COLORS[g] : "hsl(215 15% 45%)",
                }}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-1.5 rounded-md py-1.5 font-mono-display text-[10px] font-bold tracking-wider transition-all"
            style={{
              background: "linear-gradient(180deg, hsl(185 70% 30%), hsl(185 60% 20%))",
              border: "1px solid hsl(185 70% 35%)",
              color: "hsl(185 80% 75%)",
            }}
          >
            <Check className="h-3 w-3" /> SAVE CONTACT
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid hsl(215 10% 13%)" }}>
        <div
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
          style={{
            background: "hsl(215 14% 12%)",
            border: "1px solid hsl(215 10% 20%)",
          }}
        >
          <Search className="h-3 w-3 shrink-0" style={{ color: "hsl(215 15% 38%)" }} />
          <input
            type="text"
            placeholder="Search callsign, name, freq…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="font-mono-display text-[10px] tracking-wide bg-transparent outline-none flex-1 min-w-0"
            style={{ color: "hsl(200 20% 78%)", caretColor: "hsl(185 80% 55%)" }}
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X className="h-3 w-3" style={{ color: "hsl(215 15% 38%)" }} />
            </button>
          )}
        </div>
      </div>

      {/* Group filter chips */}
      <div
        className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none"
        style={{ borderBottom: "1px solid hsl(215 10% 13%)" }}
      >
        <button
          onClick={() => setSelectedGroup(null)}
          className="font-mono-display text-[8px] tracking-wider px-2 py-0.5 rounded-full shrink-0 transition-all"
          style={{
            background: !selectedGroup ? "hsl(185 80% 55% / 0.15)" : "hsl(215 14% 14%)",
            border: `1px solid ${!selectedGroup ? "hsl(185 80% 55% / 0.4)" : "hsl(215 10% 20%)"}`,
            color: !selectedGroup ? "hsl(185 80% 65%)" : "hsl(215 15% 42%)",
          }}
        >
          ALL
        </button>
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
            className="font-mono-display text-[8px] tracking-wider px-2 py-0.5 rounded-full shrink-0 transition-all"
            style={{
              background: selectedGroup === g ? `${GROUP_COLORS[g]}22` : "hsl(215 14% 14%)",
              border: `1px solid ${selectedGroup === g ? GROUP_COLORS[g] : "hsl(215 10% 20%)"}`,
              color: selectedGroup === g ? GROUP_COLORS[g] : "hsl(215 15% 42%)",
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Radio className="h-6 w-6 opacity-20" />
            <span className="font-mono-display text-[10px] tracking-wider opacity-40">NO CONTACTS FOUND</span>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "hsl(215 10% 13%)" }}>
            {filtered.map((contact) => {
              const isTuned = tunedId === contact.id;
              const groupColor = GROUP_COLORS[contact.group ?? ""] ?? "hsl(215 15% 42%)";
              return (
                <button
                  key={contact.id}
                  onClick={() => handleTune(contact)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150 active:brightness-125"
                  style={{
                    background: isTuned ? "hsl(185 80% 55% / 0.08)" : "transparent",
                  }}
                >
                  {/* Group colour dot */}
                  <div
                    className="shrink-0 rounded-full"
                    style={{
                      width: "6px",
                      height: "6px",
                      background: groupColor,
                      boxShadow: `0 0 6px ${groupColor}`,
                    }}
                  />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono-display text-[11px] font-bold tracking-wider"
                        style={{ color: isTuned ? "hsl(185 80% 65%)" : "hsl(185 60% 70%)" }}
                      >
                        {contact.callsign}
                      </span>
                      <span
                        className="font-mono-display text-[9px] tracking-wide truncate"
                        style={{ color: "hsl(215 15% 50%)" }}
                      >
                        {contact.name}
                      </span>
                    </div>
                    <div
                      className="font-mono-display text-[10px] tracking-wider mt-0.5"
                      style={{ color: isTuned ? "hsl(185 80% 55%)" : "hsl(200 20% 60%)" }}
                    >
                      {contact.frequency} MHz
                    </div>
                  </div>

                  {/* Tune indicator */}
                  <div className="shrink-0 flex items-center justify-center">
                    {isTuned ? (
                      <div
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                        style={{
                          background: "hsl(185 80% 55% / 0.15)",
                          border: "1px solid hsl(185 80% 55% / 0.35)",
                        }}
                      >
                        <Check className="h-3 w-3" style={{ color: "hsl(185 80% 65%)" }} />
                        <span
                          className="font-mono-display text-[8px] font-bold tracking-wider"
                          style={{ color: "hsl(185 80% 65%)" }}
                        >
                          TUNED
                        </span>
                      </div>
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" style={{ color: "hsl(215 15% 28%)" }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsScreen;
