import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search, Radio, UserPlus, X, Check, ChevronRight, Trash2,
  Download, Upload, BookUser, Plus, Filter,
} from "lucide-react";
import SwipeToDelete from "@/components/ui/SwipeToDelete";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Contact {
  id: string;
  callsign: string;
  name: string;
  frequency: number;
  freq_offset: number;
  duplex: string;
  tone_mode: string;
  r_tone_freq: number;
  c_tone_freq: number;
  dtcs_code: string;
  mode: string;
  country: string;
  region: string;
  location_desc: string;
  comment: string;
  group_tag: string;
  source_repeater_id: string | null;
}

interface Repeater {
  id: string;
  callsign: string | null;
  name: string;
  frequency: number;
  freq_offset: number | null;
  duplex: string | null;
  tone_mode: string | null;
  r_tone_freq: number | null;
  c_tone_freq: number | null;
  dtcs_code: string | null;
  mode: string | null;
  country: string;
  region: string | null;
  location_desc: string | null;
  comment: string | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  REPEATERS: "hsl(185 80% 55%)",
  LOCAL:     "hsl(142 70% 50%)",
  DX:        "hsl(270 70% 65%)",
  APRS:      "hsl(45 90% 55%)",
  EMCOMM:    "hsl(0 85% 60%)",
  NET:       "hsl(210 80% 60%)",
};

const GROUPS = ["LOCAL", "REPEATERS", "DX", "APRS", "EMCOMM", "NET"];

const MODE_COLORS: Record<string, string> = {
  FM:   "hsl(185 80% 55%)",
  DMR:  "hsl(270 70% 65%)",
  "D-STAR": "hsl(45 90% 55%)",
  "C4FM": "hsl(142 70% 50%)",
  AM:   "hsl(30 90% 60%)",
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatFreq(f: number | string) {
  const n = typeof f === "string" ? parseFloat(f) : f;
  return isNaN(n) ? String(f) : n.toFixed(5);
}

// ─────────────────────────────────────────────
// Contact row (uses global SwipeToDelete)
// ─────────────────────────────────────────────

interface ContactRowProps {
  contact: Contact;
  isTuned: boolean;
  onTune: () => void;
  onDelete: () => void;
}

const ContactRow = ({ contact, isTuned, onTune, onDelete }: ContactRowProps) => {
  const groupColor = GROUP_COLORS[contact.group_tag ?? ""] ?? "hsl(215 15% 42%)";
  const [actionsOpen, setActionsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleRowTap = () => setActionsOpen((v) => !v);

  const handleTune = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTune();
    setActionsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(true);
    setTimeout(() => onDelete(), 260);
  };

  const ACTIONS_W = 144; // 72px tune + 72px delete

  return (
    <div
      className="relative mb-0.5 rounded-xl"
      style={{
        maxHeight: collapsed ? 0 : undefined,
        opacity: collapsed ? 0 : 1,
        overflow: "hidden",
        transition: collapsed ? "max-height 0.26s ease, opacity 0.22s ease" : "none",
      }}
    >
      {/* Action buttons revealed behind the row */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{
          width: ACTIONS_W,
          pointerEvents: actionsOpen ? "auto" : "none",
          opacity: actionsOpen ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      >
        {/* Green TUNE */}
        <button
          onClick={handleTune}
          className="flex flex-col items-center justify-center gap-0.5 active:opacity-70 transition-opacity"
          style={{
            width: 72,
            background: "linear-gradient(135deg, hsl(142 60% 28%), hsl(142 65% 20%))",
            borderRight: "1px solid hsl(142 60% 18%)",
          }}
          aria-label="Tune"
        >
          <Radio className="h-4 w-4" style={{ color: "hsl(0 0% 92%)" }} />
          <span className="font-mono-display font-bold tracking-widest" style={{ fontSize: "7px", color: "hsl(0 0% 85%)" }}>
            TUNE
          </span>
        </button>

        {/* Red DELETE */}
        <button
          onClick={handleDelete}
          className="flex flex-col items-center justify-center gap-0.5 active:opacity-70 transition-opacity"
          style={{
            width: 72,
            background: "linear-gradient(135deg, hsl(0 72% 40%), hsl(0 80% 28%))",
          }}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" style={{ color: "hsl(0 0% 95%)" }} />
          <span className="font-mono-display font-bold tracking-widest" style={{ fontSize: "7px", color: "hsl(0 0% 85%)" }}>
            DELETE
          </span>
        </button>
      </div>

      {/* Row — slides left when actions open */}
      <div
        onClick={handleRowTap}
        style={{
          transform: actionsOpen ? `translateX(-${ACTIONS_W}px)` : "translateX(0)",
          transition: "transform 0.22s cubic-bezier(0.32,0.72,0,1)",
          position: "relative",
          zIndex: 1,
          cursor: "pointer",
        }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: isTuned
              ? "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.04))"
              : "linear-gradient(135deg, hsl(210 18% 14%), hsl(210 18% 10%))",
            border: `1px solid ${isTuned ? "hsl(var(--primary) / 0.2)" : "hsl(210 15% 22% / 0.5)"}`,
          }}
        >
          {/* Group colour dot */}
          <div
            className="shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: groupColor, boxShadow: `0 0 6px ${groupColor}` }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`tab-callsign ${isTuned ? "tab-callsign-primary" : ""}`}
                style={!isTuned ? { color: "hsl(38 92% 50%)" } : undefined}>
                {contact.callsign || contact.name}
              </span>
              {contact.callsign && (
                <span className="tab-meta truncate">{contact.name}</span>
              )}
              {contact.mode && (
                <span
                  className="tab-label px-1 rounded shrink-0"
                  style={{
                    color: MODE_COLORS[contact.mode] ?? "hsl(var(--muted-foreground))",
                    background: `${MODE_COLORS[contact.mode] ?? "hsl(215 15% 50%)"}1a`,
                    border: `1px solid ${MODE_COLORS[contact.mode] ?? "hsl(215 15% 50%)"}33`,
                  }}
                >
                  {contact.mode}
                </span>
              )}
            </div>
            <p className="tab-body leading-snug">
              {formatFreq(contact.frequency)}{" "}
              <span className="tab-meta">MHz</span>
              {contact.location_desc ? (
                <span className="tab-meta ml-2">{contact.location_desc}</span>
              ) : null}
            </p>
          </div>

          <div className="shrink-0">
            {actionsOpen ? (
              <X className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
            ) : isTuned ? (
              <div
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                style={{
                  background: "hsl(142 65% 32% / 0.15)",
                  border: "1px solid hsl(142 65% 32% / 0.35)",
                }}
              >
                <Check className="h-3 w-3" style={{ color: "hsl(142 65% 55%)" }} />
                <span className="font-mono-display text-[8px] font-bold tracking-wider" style={{ color: "hsl(142 65% 55%)" }}>TUNED</span>
              </div>
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-border" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Repeater Browser Row
// ─────────────────────────────────────────────

interface RepeaterRowProps {
  repeater: Repeater;
  onTune: () => void;
  onAddToContacts: () => void;
  isAdded: boolean;
}

const RepeaterRow = ({ repeater, onTune, onAddToContacts, isAdded }: RepeaterRowProps) => {
  const modeColor = MODE_COLORS[repeater.mode ?? "FM"] ?? "hsl(var(--primary))";

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 mx-1 mb-0.5 rounded-xl"
      style={{
        background: "linear-gradient(135deg, hsl(210 18% 14%), hsl(210 18% 10%))",
        border: "1px solid hsl(210 15% 22% / 0.5)",
      }}
    >
      <div className="flex-1 min-w-0">
        {/* Callsign row */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="tab-callsign" style={{ color: "hsl(38 92% 50%)" }}>
            {repeater.callsign || repeater.name}
          </span>
          {repeater.callsign && (
            <span className="tab-meta truncate">{repeater.name}</span>
          )}
          {repeater.mode && (
            <span className="tab-label px-1 rounded shrink-0"
              style={{ color: modeColor, background: `${modeColor}1a`, border: `1px solid ${modeColor}33` }}>
              {repeater.mode}
            </span>
          )}
        </div>
        {/* Body */}
        <p className="tab-body leading-snug">
          {formatFreq(repeater.frequency)} <span className="tab-meta">MHz</span>
          {repeater.tone_mode && repeater.tone_mode !== "" && (
            <span className="tab-meta ml-2">{repeater.tone_mode}{repeater.r_tone_freq ? ` ${repeater.r_tone_freq}Hz` : ""}</span>
          )}
          {repeater.location_desc && (
            <span className="tab-meta ml-2 truncate"> · {repeater.location_desc}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onTune}
          className="flex items-center justify-center rounded-lg w-8 h-8 transition-all active:brightness-125"
          style={{ background: "hsl(185 60% 55% / 0.15)", border: "1px solid hsl(185 60% 55% / 0.25)" }}
          title="Tune to frequency"
        >
          <Radio className="h-3.5 w-3.5 text-primary" />
        </button>
        <button
          onClick={onAddToContacts}
          disabled={isAdded}
          className="flex items-center justify-center rounded-lg w-8 h-8 transition-all active:brightness-125 disabled:opacity-40"
          style={{
            background: isAdded ? "hsl(142 60% 55% / 0.15)" : "hsl(var(--secondary))",
            border: `1px solid ${isAdded ? "hsl(142 60% 55% / 0.3)" : "hsl(var(--border))"}`,
          }}
          title={isAdded ? "Already in contacts" : "Add to contacts"}
        >
          {isAdded
            ? <Check className="h-3.5 w-3.5" style={{ color: "hsl(142 60% 60%)" }} />
            : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// My Contacts Tab
// ─────────────────────────────────────────────

interface MyContactsTabProps {
  onTuneChannel: (freq: string) => void;
  activeChannel: "A" | "B";
}

const MyContactsTab = ({ onTuneChannel, activeChannel }: MyContactsTabProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [tunedId, setTunedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ callsign: "", name: "", frequency: "", group_tag: "LOCAL", mode: "FM" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load contacts
  const loadContacts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
    if (data) setContacts(data as Contact[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const groups = useMemo(() => Array.from(new Set(contacts.map((c) => c.group_tag).filter(Boolean))) as string[], [contacts]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return contacts.filter((c) => {
      const matchesQuery = !q || c.callsign.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || String(c.frequency).includes(q);
      const matchesGroup = !selectedGroup || c.group_tag === selectedGroup;
      return matchesQuery && matchesGroup;
    });
  }, [contacts, query, selectedGroup]);

  const handleTune = (contact: Contact) => {
    onTuneChannel(formatFreq(contact.frequency));
    setTunedId(contact.id);
    setTimeout(() => setTunedId(null), 1500);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (tunedId === id) setTunedId(null);
  };

  const handleAdd = async () => {
    if (!newContact.frequency.trim()) return;
    const freq = parseFloat(newContact.frequency);
    if (isNaN(freq)) return;
    const { data, error } = await supabase.from("contacts").insert({
      callsign: newContact.callsign.toUpperCase().trim(),
      name: newContact.name.trim() || newContact.callsign.toUpperCase().trim(),
      frequency: freq,
      group_tag: newContact.group_tag,
      mode: newContact.mode,
    }).select().single();
    if (!error && data) {
      setContacts((prev) => [data as Contact, ...prev]);
      setNewContact({ callsign: "", name: "", frequency: "", group_tag: "LOCAL", mode: "FM" });
      setShowAdd(false);
    }
  };

  // Export as CSV
  const handleExport = () => {
    const headers = ["callsign", "name", "frequency", "freq_offset", "duplex", "tone_mode", "r_tone_freq", "c_tone_freq", "dtcs_code", "mode", "country", "region", "location_desc", "comment", "group_tag"];
      const rows = contacts.map((c) =>
      headers.map((h) => {
        const val = (c as unknown as Record<string, unknown>)[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from CSV
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());

    const parseRow = (line: string) => {
      // Simple CSV parse (handles quoted fields)
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === "," && !inQuotes) { result.push(current); current = ""; }
        else { current += char; }
      }
      result.push(current);
      return result;
    };

    const records = lines.slice(1).map((line) => {
      const vals = parseRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i]?.replace(/^"|"$/g, "") ?? ""; });
      return obj;
    }).filter((r) => r.frequency && !isNaN(parseFloat(r.frequency)));

    if (records.length === 0) return;

    const inserts = records.map((r) => ({
      callsign: r.callsign ?? "",
      name: r.name ?? r.callsign ?? "",
      frequency: parseFloat(r.frequency),
      freq_offset: r.freq_offset ? parseFloat(r.freq_offset) : 0,
      duplex: r.duplex ?? "",
      tone_mode: r.tone_mode ?? "",
      r_tone_freq: r.r_tone_freq ? parseFloat(r.r_tone_freq) : 88.5,
      c_tone_freq: r.c_tone_freq ? parseFloat(r.c_tone_freq) : 88.5,
      dtcs_code: r.dtcs_code ?? "023",
      mode: r.mode ?? "FM",
      country: r.country ?? "",
      region: r.region ?? "",
      location_desc: r.location_desc ?? "",
      comment: r.comment ?? "",
      group_tag: r.group_tag ?? "LOCAL",
    }));

    await supabase.from("contacts").insert(inserts);
    await loadContacts();
    e.target.value = "";
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <span className="tab-label">{contacts.length} CONTACTS</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-md px-2 py-1 tab-label transition-all bg-secondary border border-border hover:text-foreground"
            title="Export contacts as CSV"
          >
            <Download className="h-3 w-3" /> EXP
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-md px-2 py-1 tab-label transition-all bg-secondary border border-border hover:text-foreground"
            title="Import contacts from CSV"
          >
            <Upload className="h-3 w-3" /> IMP
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center justify-center rounded-md transition-all w-[26px] h-[26px]"
            style={{
              background: showAdd ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))",
              border: `1px solid ${showAdd ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))"}`,
              color: showAdd ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}
          >
            {showAdd ? <X className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Add form — styled like APRS compose area */}
      {showAdd && (
        <div className="px-3 py-2.5 flex flex-col gap-1.5 border-b border-border/40 bg-card/50">
          <div className="grid grid-cols-2 gap-1.5">
            <input type="text" placeholder="CALLSIGN" value={newContact.callsign}
              onChange={(e) => setNewContact((p) => ({ ...p, callsign: e.target.value.toUpperCase() }))}
              className="tab-input text-primary"
            />
            <input type="text" placeholder="FREQUENCY" value={newContact.frequency}
              onChange={(e) => setNewContact((p) => ({ ...p, frequency: e.target.value }))}
              className="tab-input"
            />
          </div>
          <input type="text" placeholder="Name / Description" value={newContact.name}
            onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
            className="tab-input"
          />
          <div className="flex gap-1 flex-wrap">
            {GROUPS.map((g) => (
              <button key={g} onClick={() => setNewContact((p) => ({ ...p, group_tag: g }))}
                className={`tab-chip ${newContact.group_tag === g ? "tab-chip-active" : ""} transition-all`}
                style={newContact.group_tag === g ? {
                  background: `${GROUP_COLORS[g]}22`,
                  borderColor: GROUP_COLORS[g],
                  color: GROUP_COLORS[g],
                } : undefined}
              >{g}</button>
            ))}
          </div>
          <button onClick={handleAdd}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 tab-section-title transition-all"
            style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))", border: "1px solid hsl(var(--primary) / 0.25)" }}
          >
            <Check className="h-3 w-3" /> SAVE CONTACT
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "linear-gradient(180deg, hsl(210 18% 12%), hsl(210 18% 9%))", border: "1px solid hsl(210 15% 20% / 0.5)" }}>
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
          <input type="text" placeholder="Search callsign, name, freq…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="tab-body bg-transparent outline-none flex-1 min-w-0"
          />
          {query && <button onClick={() => setQuery("")}><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>
      </div>

      {/* Group chips */}
      <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none border-b border-border/40">
        <button onClick={() => setSelectedGroup(null)}
          className={`tab-chip shrink-0 transition-all ${!selectedGroup ? "tab-chip-active" : ""}`}
        >ALL</button>
        {groups.map((g) => (
          <button key={g} onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
            className="tab-chip shrink-0 transition-all"
            style={selectedGroup === g ? {
              background: `${GROUP_COLORS[g] ?? "hsl(var(--primary))"}22`,
              borderColor: GROUP_COLORS[g] ?? "hsl(var(--primary))",
              color: GROUP_COLORS[g] ?? "hsl(var(--primary))",
            } : undefined}
          >{g}</button>
        ))}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-1 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="tab-meta">LOADING…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <BookUser className="h-6 w-6 opacity-20 text-muted-foreground" />
            <span className="tab-meta opacity-40">
              {contacts.length === 0 ? "NO CONTACTS YET" : "NO MATCH"}
            </span>
            {contacts.length === 0 && (
              <span className="tab-label text-center px-6 opacity-50">
                Add manually or browse the repeater directory →
              </span>
            )}
          </div>
        ) : (
          filtered.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              isTuned={tunedId === contact.id}
              onTune={() => handleTune(contact)}
              onDelete={() => handleDelete(contact.id)}
            />
          ))
        )}
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────
// Repeater Browser Tab
// ─────────────────────────────────────────────

interface RepeaterBrowserTabProps {
  onTuneChannel: (freq: string) => void;
  activeChannel: "A" | "B";
}

const RepeaterBrowserTab = ({ onTuneChannel }: RepeaterBrowserTabProps) => {
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  // Load available countries
  useEffect(() => {
    supabase.from("repeaters").select("country").then(({ data }) => {
      if (data) {
        const unique = Array.from(new Set(data.map((r) => r.country))).sort();
        setCountries(unique);
      }
    });
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      fetchRepeaters(0);
    }, 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedCountry, selectedMode]);

  const fetchRepeaters = async (pageNum: number) => {
    setLoading(true);
    let q = supabase
      .from("repeaters")
      .select("id,callsign,name,frequency,freq_offset,duplex,tone_mode,r_tone_freq,c_tone_freq,dtcs_code,mode,country,region,location_desc,comment")
      .order("frequency", { ascending: true })
      .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);

    if (selectedCountry) q = q.eq("country", selectedCountry);
    if (selectedMode) q = q.eq("mode", selectedMode);
    if (query.trim()) {
      q = q.or(`callsign.ilike.%${query}%,name.ilike.%${query}%,location_desc.ilike.%${query}%`);
    }

    const { data } = await q;
    if (data) {
      if (pageNum === 0) setRepeaters(data as Repeater[]);
      else setRepeaters((prev) => [...prev, ...data as Repeater[]]);
    }
    setLoading(false);
  };

  const handleAddToContacts = async (repeater: Repeater) => {
    const { data, error } = await supabase.from("contacts").insert({
      callsign: repeater.callsign ?? "",
      name: repeater.name,
      frequency: repeater.frequency,
      freq_offset: repeater.freq_offset ?? 0,
      duplex: repeater.duplex ?? "",
      tone_mode: repeater.tone_mode ?? "",
      r_tone_freq: repeater.r_tone_freq ?? 88.5,
      c_tone_freq: repeater.c_tone_freq ?? 88.5,
      dtcs_code: repeater.dtcs_code ?? "023",
      mode: repeater.mode ?? "FM",
      country: repeater.country,
      region: repeater.region ?? "",
      location_desc: repeater.location_desc ?? "",
      comment: repeater.comment ?? "",
      group_tag: "REPEATERS",
      source_repeater_id: repeater.id,
    }).select().single();
    if (!error && data) {
      setAddedIds((prev) => new Set([...prev, repeater.id]));
    }
  };

  const modes = ["FM", "DMR", "D-STAR", "C4FM", "AM"];

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchRepeaters(next);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "linear-gradient(180deg, hsl(210 18% 12%), hsl(210 18% 9%))", border: "1px solid hsl(210 15% 20% / 0.5)" }}>
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
          <input type="text" placeholder="Callsign, name, location…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="tab-body bg-transparent outline-none flex-1 min-w-0"
          />
          {query && <button onClick={() => setQuery("")}><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>
      </div>

      {/* Country filter chips */}
      <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none border-b border-border/40">
        <Filter className="h-3 w-3 shrink-0 self-center text-muted-foreground/40" />
        <button onClick={() => setSelectedCountry(null)}
          className={`tab-chip shrink-0 transition-all ${!selectedCountry ? "tab-chip-active" : ""}`}
        >ALL</button>
        {countries.map((c) => (
          <button key={c} onClick={() => setSelectedCountry(selectedCountry === c ? null : c)}
            className={`tab-chip shrink-0 transition-all ${selectedCountry === c ? "tab-chip-active" : ""}`}
          >{c}</button>
        ))}
      </div>

      {/* Mode filter chips */}
      <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none border-b border-border/40">
        <button onClick={() => setSelectedMode(null)}
          className={`tab-chip shrink-0 transition-all ${!selectedMode ? "tab-chip-active" : ""}`}
        >ANY MODE</button>
        {modes.map((m) => {
          const mc = MODE_COLORS[m] ?? "hsl(var(--primary))";
          return (
            <button key={m} onClick={() => setSelectedMode(selectedMode === m ? null : m)}
              className="tab-chip shrink-0 transition-all"
              style={selectedMode === m ? { background: `${mc}22`, borderColor: mc, color: mc } : undefined}
            >{m}</button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-1 space-y-0.5">
        {loading && repeaters.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="tab-meta">SCANNING DATABASE…</span>
          </div>
        ) : repeaters.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Radio className="h-6 w-6 opacity-20 text-muted-foreground" />
            <span className="tab-meta opacity-40">NO REPEATERS FOUND</span>
            <span className="tab-label text-center px-6 opacity-50">
              Import data from the Settings tab first
            </span>
          </div>
        ) : (
          <>
            {repeaters.map((r) => (
              <RepeaterRow
                key={r.id}
                repeater={r}
                onTune={() => onTuneChannel(formatFreq(r.frequency))}
                onAddToContacts={() => handleAddToContacts(r)}
                isAdded={addedIds.has(r.id)}
              />
            ))}
            {repeaters.length % PAGE_SIZE === 0 && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full tab-label py-3 transition-all text-primary/60 hover:text-primary"
              >
                {loading ? "LOADING…" : "LOAD MORE"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main ContactsScreen
// ─────────────────────────────────────────────

interface ContactsScreenProps {
  onTuneChannel: (frequency: string) => void;
  activeChannel: "A" | "B";
}

const ContactsScreen = ({ onTuneChannel, activeChannel }: ContactsScreenProps) => {
  const [tab, setTab] = useState<"contacts" | "repeaters">("contacts");

  return (
    <div className="tab-panel flex flex-col w-full h-full animate-fade-in">
      {/* Header */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {/* Sub-tab toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid hsl(var(--border) / 0.5)" }}>
            <button
              onClick={() => setTab("contacts")}
              className="flex items-center gap-1.5 px-2.5 py-1 transition-all"
              style={{
                background: tab === "contacts" ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))",
                borderRight: "1px solid hsl(var(--border) / 0.5)",
              }}
            >
              <BookUser className="h-3 w-3" style={{ color: tab === "contacts" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
              <span className="tab-callsign" style={{ color: tab === "contacts" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>MY LIST</span>
            </button>
            <button
              onClick={() => setTab("repeaters")}
              className="flex items-center gap-1.5 px-2.5 py-1 transition-all"
              style={{ background: tab === "repeaters" ? "hsl(var(--primary) / 0.2)" : "hsl(var(--secondary))" }}
            >
              <Radio className="h-3 w-3" style={{ color: tab === "repeaters" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
              <span className="tab-callsign" style={{ color: tab === "repeaters" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>REPEATERS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === "contacts" ? (
        <MyContactsTab onTuneChannel={onTuneChannel} activeChannel={activeChannel} />
      ) : (
        <RepeaterBrowserTab onTuneChannel={onTuneChannel} activeChannel={activeChannel} />
      )}
    </div>
  );
};

export default ContactsScreen;
