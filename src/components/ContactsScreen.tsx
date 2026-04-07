import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search, Radio, X, Check, ChevronRight, Trash2,
  BookUser, Plus, Filter,
} from "lucide-react";
import { supabase } from "@/features/cloud/supabaseClient";
import { CloudFeaturesBanner } from "@/components/CloudFeaturesBanner";
import { useNavigatorOnline } from "@/hooks/use-navigator-online";
import type { BandId } from "@/lib/hardware";
import { frequencyMatchesBand, BAND_CONFIGS } from "@/lib/hardware";
import {
  buildRepeaterFilterKey,
  getCachedContactsJson,
  getCachedRepeaterCountriesJson,
  getCachedRepeaterSnapshotJson,
  setCachedContactsJson,
  setCachedRepeaterCountriesJson,
  setCachedRepeaterSnapshotJson,
} from "@/lib/cloud-data-cache";

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
// Contact row (tap to reveal TUNE + DELETE — same pattern as APRS, no swipe)
// ─────────────────────────────────────────────

interface ContactRowProps {
  contact: Contact;
  isTuned: boolean;
  onTune: () => void;
  onDelete: () => void;
}

const ACTIONS_W = 144; // 72px TUNE + 72px DELETE

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
      {/* Action buttons revealed behind the row (same pattern as APRS) */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{
          width: ACTIONS_W,
          pointerEvents: actionsOpen ? "auto" : "none",
          opacity: actionsOpen ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      >
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

      {/* Row — tap to reveal TUNE + DELETE (slides left when actions open) */}
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
                <Check className="tick-success h-3 w-3" />
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
  isTuned?: boolean;
}

const RepeaterRow = ({ repeater, onTune, onAddToContacts, isAdded, isTuned }: RepeaterRowProps) => {
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
          style={{
            background: isTuned ? "hsl(142 60% 55% / 0.15)" : "hsl(185 60% 55% / 0.15)",
            border: `1px solid ${isTuned ? "hsl(142 60% 55% / 0.3)" : "hsl(185 60% 55% / 0.25)"}`,
          }}
          title={isTuned ? "Tuned" : "Tune to frequency"}
        >
          {isTuned ? (
            <Check className="tick-success h-3.5 w-3.5" />
          ) : (
            <Radio className="h-3.5 w-3.5 text-primary" />
          )}
        </button>
        <button
          onClick={() => !isAdded && onAddToContacts()}
          className="flex items-center justify-center rounded-lg w-8 h-8 transition-all active:brightness-125"
          style={{
            background: isAdded ? "hsl(142 60% 55% / 0.15)" : "hsl(var(--secondary))",
            border: `1px solid ${isAdded ? "hsl(142 60% 55% / 0.3)" : "hsl(var(--border))"}`,
          }}
          title={isAdded ? "Already in contacts" : "Add to contacts"}
        >
          {isAdded
            ? <Check className="tick-success h-3.5 w-3.5" />
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
  onTuneChannel: (freq: string, channelName?: string) => void;
  activeChannel: "A" | "B";
  boardBand: BandId;
  onCloudDegraded: (degraded: boolean) => void;
}

const MyContactsTab = ({ onTuneChannel, activeChannel, boardBand, onCloudDegraded }: MyContactsTabProps) => {
  const online = useNavigatorOnline();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [tunedId, setTunedId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    let showedCache = false;
    try {
      const cached = await getCachedContactsJson();
      if (cached) {
        const parsed = JSON.parse(cached) as Contact[];
        if (Array.isArray(parsed)) {
          setContacts(parsed);
          showedCache = true;
          setLoading(false);
        }
      }
    } catch {
      /* ignore bad cache */
    }

    const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
    if (data) {
      setContacts(data as Contact[]);
      void setCachedContactsJson(JSON.stringify(data));
      onCloudDegraded(false);
    } else if (error) {
      onCloudDegraded(true);
    }
    setLoading(false);
  }, [onCloudDegraded]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts, online]);

  const groups = useMemo(() => Array.from(new Set(contacts.map((c) => c.group_tag).filter(Boolean))) as string[], [contacts]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return contacts.filter((c) => {
      const matchesQuery = !q || c.callsign.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || String(c.frequency).includes(q);
      const matchesGroup = !selectedGroup || c.group_tag === selectedGroup;
      const matchesBand = frequencyMatchesBand(c.frequency, boardBand);
      return matchesQuery && matchesGroup && matchesBand;
    });
  }, [contacts, query, selectedGroup, boardBand]);

  const handleTune = (contact: Contact) => {
    const name = (contact.name || contact.callsign || "").trim() || "CONTACT";
    onTuneChannel(formatFreq(contact.frequency), name);
    setTunedId(contact.id);
    setTimeout(() => setTunedId(null), 1500);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      void setCachedContactsJson(JSON.stringify(next));
      return next;
    });
    if (tunedId === id) setTunedId(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Count only — Export/Import moved to Settings > Contacts */}
      <div className="px-3 py-2 border-b border-border/40">
        <span className="tab-label">{contacts.length} CONTACTS</span>
      </div>

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
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 py-1 space-y-0.5">
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
  onTuneChannel: (freq: string, channelName?: string) => void;
  activeChannel: "A" | "B";
  boardBand: BandId;
  onCloudDegraded: (degraded: boolean) => void;
}

const RepeaterBrowserTab = ({ onTuneChannel, boardBand, onCloudDegraded }: RepeaterBrowserTabProps) => {
  const online = useNavigatorOnline();
  const [repeaters, setRepeaters] = useState<Repeater[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  /** Repeater IDs already in My List (contacts with source_repeater_id) — loaded from DB so tick persists */
  const [repeaterIdsInContacts, setRepeaterIdsInContacts] = useState<Set<string>>(new Set());
  const [tunedId, setTunedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedRepeaterCountriesJson();
        if (cached) {
          const list = JSON.parse(cached) as string[];
          if (Array.isArray(list) && list.length) setCountries(list);
        }
      } catch {
        /* ignore */
      }
      const { data, error } = await supabase.from("repeaters").select("country");
      if (data) {
        const unique = Array.from(new Set(data.map((r) => r.country))).sort();
        setCountries(unique);
        void setCachedRepeaterCountriesJson(JSON.stringify(unique));
        onCloudDegraded(false);
      } else if (error) {
        onCloudDegraded(true);
      }
    })();
  }, [onCloudDegraded, online]);

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedContactsJson();
        if (cached) {
          const arr = JSON.parse(cached) as { source_repeater_id?: string | null }[];
          if (Array.isArray(arr)) {
            const ids = new Set(
              arr.map((r) => r.source_repeater_id).filter((x): x is string => Boolean(x))
            );
            if (ids.size) setRepeaterIdsInContacts(ids);
          }
        }
      } catch {
        /* ignore */
      }
      const { data } = await supabase.from("contacts").select("source_repeater_id").not("source_repeater_id", "is", null);
      if (data) {
        const ids = new Set((data as { source_repeater_id: string }[]).map((r) => r.source_repeater_id));
        setRepeaterIdsInContacts(ids);
      }
    })();
  }, []);

  // Debounced search — re-runs when boardBand changes too
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      fetchRepeaters(0);
    }, 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedCountry, selectedMode, boardBand, online]);

  const fetchRepeaters = async (pageNum: number) => {
    setLoading(true);
    const filterKey = buildRepeaterFilterKey({
      query,
      selectedCountry,
      selectedMode,
      boardBand: boardBand ?? null,
    });

    if (pageNum === 0) {
      try {
        const snap = await getCachedRepeaterSnapshotJson(filterKey);
        if (snap) {
          const { rows } = JSON.parse(snap) as { rows: Repeater[] };
          if (Array.isArray(rows) && rows.length) setRepeaters(rows);
        }
      } catch {
        /* ignore */
      }
    }

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

    if (boardBand && boardBand !== "DUAL") {
      const cfg = BAND_CONFIGS[boardBand];
      q = q.gte("frequency", cfg.minMHz).lte("frequency", cfg.maxMHz);
    }

    const { data, error } = await q;
    if (data) {
      if (pageNum === 0) {
        setRepeaters(data as Repeater[]);
        void setCachedRepeaterSnapshotJson(filterKey, JSON.stringify({ rows: data as Repeater[] }));
      } else {
        setRepeaters((prev) => [...prev, ...(data as Repeater[])]);
      }
      onCloudDegraded(false);
    } else if (error) {
      onCloudDegraded(true);
      if (pageNum === 0) {
        const snap = await getCachedRepeaterSnapshotJson(filterKey);
        if (snap) {
          try {
            const { rows } = JSON.parse(snap) as { rows: Repeater[] };
            if (Array.isArray(rows) && rows.length) setRepeaters(rows);
          } catch {
            /* ignore */
          }
        }
      }
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
      setRepeaterIdsInContacts((prev) => new Set([...prev, repeater.id]));
      const row = data as unknown as Contact;
      const cached = await getCachedContactsJson();
      if (cached) {
        try {
          const arr = JSON.parse(cached) as Contact[];
          if (Array.isArray(arr)) {
            void setCachedContactsJson(
              JSON.stringify([row, ...arr.filter((c) => c.id !== row.id)])
            );
          }
        } catch {
          /* ignore */
        }
      }
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
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 py-1 space-y-0.5">
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
                onTune={() => {
                  const name = (r.callsign || r.name || "").trim() || "REPEATER";
                  onTuneChannel(formatFreq(r.frequency), name);
                  setTunedId(r.id);
                  setTimeout(() => setTunedId(null), 1500);
                }}
                onAddToContacts={() => handleAddToContacts(r)}
                isAdded={repeaterIdsInContacts.has(r.id)}
                isTuned={tunedId === r.id}
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
  onTuneChannel: (frequency: string, channelName?: string) => void;
  activeChannel: "A" | "B";
  /** Band locked by the connected hardware board. Null = no filtering. */
  boardBand: BandId;
}

const ContactsScreen = ({ onTuneChannel, activeChannel, boardBand }: ContactsScreenProps) => {
  const [tab, setTab] = useState<"contacts" | "repeaters">("contacts");
  const online = useNavigatorOnline();
  const [contactsCloudBad, setContactsCloudBad] = useState(false);
  const [repeatersCloudBad, setRepeatersCloudBad] = useState(false);

  const cloudBannerKind =
    !online ? "offline" : contactsCloudBad || repeatersCloudBad ? "cloud" : null;

  const bandCfg = boardBand && boardBand !== "DUAL" ? BAND_CONFIGS[boardBand] : null;

  return (
    <div className="tab-panel flex flex-col flex-1 min-h-0 w-full animate-fade-in overflow-hidden">
      {/* Header — page title left (match APRS/Settings), sub-tabs right */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BookUser className="h-4 w-4 text-primary" />
          <span className="tab-section-title">CONTACTS</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab toggle — right side */}
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

          {/* Band lock badge — when hardware board imposes a band filter */}
          {bandCfg && (
            <span
              className="tab-label px-2 py-0.5 rounded-full"
              style={{
                color: bandCfg.color,
                background: `${bandCfg.color.replace(")", " / 0.12)")}`,
                border: `1px solid ${bandCfg.color.replace(")", " / 0.3)")}`,
                letterSpacing: "0.12em",
              }}
            >
              {bandCfg.badge} ONLY
            </span>
          )}
          {boardBand === "DUAL" && (
            <span className="tab-label px-2 py-0.5 rounded-full"
              style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.12)", border: "1px solid hsl(var(--primary) / 0.3)" }}>
              DUAL
            </span>
          )}
        </div>
      </div>

      <div className="px-2 pb-1 flex-shrink-0">
        <CloudFeaturesBanner kind={cloudBannerKind} />
      </div>

      {/* Tab content */}
      {tab === "contacts" ? (
        <MyContactsTab
          onTuneChannel={onTuneChannel}
          activeChannel={activeChannel}
          boardBand={boardBand}
          onCloudDegraded={setContactsCloudBad}
        />
      ) : (
        <RepeaterBrowserTab
          onTuneChannel={onTuneChannel}
          activeChannel={activeChannel}
          boardBand={boardBand}
          onCloudDegraded={setRepeatersCloudBad}
        />
      )}
    </div>
  );
};

export default ContactsScreen;
