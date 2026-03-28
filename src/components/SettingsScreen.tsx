import { useState, useRef, useEffect } from "react";
import {
  Upload, Download, Trash2, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronRight, Globe, AlertTriangle, Radio, Save, MapPin, RefreshCw, Map,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportResult { inserted: number; total?: number; error?: string; }
interface KmlImportResult { updated: number; error?: string; }

interface SettingsScreenProps {
  myCallsign: string;
  onCallsignChange: (value: string) => void;
  captionsLang: string;
  onCaptionsLangChange: (lang: string) => void;
}

const EDGE_FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/import-chirp-csv`;

async function importCsvToDb(csvText: string, country: string, clearFirst = false): Promise<ImportResult> {
  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csvText, country, clearFirst }),
  });
  return res.json();
}

const KML_NS = "http://www.opengis.net/kml/2.2";

function getChildByTag(el: Element, tag: string, ns: string | null): Element | undefined {
  return (ns ? el.getElementsByTagNameNS(ns, tag)[0] : el.getElementsByTagName(tag)[0]) ?? undefined;
}

function parseKml(kmlText: string): { name: string; lat: number; lng: number }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, "text/xml");
  let placemarks = doc.getElementsByTagNameNS(KML_NS, "Placemark");
  const useNs = placemarks.length > 0;
  if (!useNs) placemarks = doc.getElementsByTagName("Placemark");
  const ns = useNs ? KML_NS : null;
  const out: { name: string; lat: number; lng: number }[] = [];
  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = getChildByTag(pm, "name", ns);
    const name = nameEl?.textContent?.trim() ?? "";
    const point = getChildByTag(pm, "Point", ns);
    if (!point) continue;
    const coordEl = getChildByTag(point, "coordinates", ns);
    const coordText = coordEl?.textContent?.trim();
    if (!coordText) continue;
    const parts = coordText.split(",").map((s) => s.trim());
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!name || isNaN(lat) || isNaN(lng)) continue;
    out.push({ name, lat, lng });
  }
  return out;
}

const COUNTRY_OPTIONS = [
  // North America
  { value: "United States",        label: "🇺🇸 United States" },
  { value: "Canada",               label: "🇨🇦 Canada" },
  { value: "Mexico",               label: "🇲🇽 Mexico" },
  // Europe
  { value: "United Kingdom",       label: "🇬🇧 United Kingdom" },
  { value: "Germany",              label: "🇩🇪 Germany" },
  { value: "France",               label: "🇫🇷 France" },
  { value: "Italy",                label: "🇮🇹 Italy" },
  { value: "Spain",                label: "🇪🇸 Spain" },
  { value: "Netherlands",          label: "🇳🇱 Netherlands" },
  { value: "Belgium",              label: "🇧🇪 Belgium" },
  { value: "Switzerland",          label: "🇨🇭 Switzerland" },
  { value: "Austria",              label: "🇦🇹 Austria" },
  { value: "Sweden",               label: "🇸🇪 Sweden" },
  { value: "Norway",               label: "🇳🇴 Norway" },
  { value: "Denmark",              label: "🇩🇰 Denmark" },
  { value: "Finland",              label: "🇫🇮 Finland" },
  { value: "Poland",               label: "🇵🇱 Poland" },
  { value: "Czech Republic",       label: "🇨🇿 Czech Republic" },
  { value: "Portugal",             label: "🇵🇹 Portugal" },
  { value: "Greece",               label: "🇬🇷 Greece" },
  { value: "Hungary",              label: "🇭🇺 Hungary" },
  { value: "Romania",              label: "🇷🇴 Romania" },
  { value: "Ireland",              label: "🇮🇪 Ireland" },
  // Asia-Pacific
  { value: "Australia",            label: "🇦🇺 Australia" },
  { value: "New Zealand",          label: "🇳🇿 New Zealand" },
  { value: "Japan",                label: "🇯🇵 Japan" },
  { value: "South Korea",          label: "🇰🇷 South Korea" },
  { value: "China",                label: "🇨🇳 China" },
  { value: "India",                label: "🇮🇳 India" },
  { value: "Singapore",            label: "🇸🇬 Singapore" },
  { value: "Malaysia",             label: "🇲🇾 Malaysia" },
  { value: "Philippines",          label: "🇵🇭 Philippines" },
  { value: "Indonesia",            label: "🇮🇩 Indonesia" },
  { value: "Thailand",             label: "🇹🇭 Thailand" },
  { value: "Taiwan",               label: "🇹🇼 Taiwan" },
  { value: "Hong Kong",            label: "🇭🇰 Hong Kong" },
  // Middle East & Africa
  { value: "Israel",               label: "🇮🇱 Israel" },
  { value: "South Africa",         label: "🇿🇦 South Africa" },
  { value: "United Arab Emirates", label: "🇦🇪 United Arab Emirates" },
  // South America
  { value: "Brazil",               label: "🇧🇷 Brazil" },
  { value: "Argentina",            label: "🇦🇷 Argentina" },
  { value: "Chile",                label: "🇨🇱 Chile" },
  { value: "Colombia",             label: "🇨🇴 Colombia" },
  // Other
  { value: "Other",                label: "🌍 Other" },
];

/* ── Collapsible section ── */
const Section = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tab-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
        style={{ borderBottom: open ? "1px solid hsl(var(--border) / 0.4)" : "none" }}
      >
        <span className="tab-section-title">{title}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 py-3">{children}</div>}
    </div>
  );
};

const StatusBadge = ({ result }: { result: ImportResult | null }) => {
  if (!result) return null;
  const ok = !result.error;
  return (
    <div className="flex items-start gap-2 rounded-xl px-2.5 py-2 mt-2"
      style={{
        background: ok ? "hsl(142 70% 50% / 0.08)" : "hsl(0 85% 60% / 0.08)",
        border: `1px solid ${ok ? "hsl(142 70% 50% / 0.25)" : "hsl(0 85% 60% / 0.25)"}`,
      }}>
      {ok
        ? <CheckCircle2 className="tick-success h-3.5 w-3.5 mt-0.5" />
        : <XCircle className="tick-error h-3.5 w-3.5 mt-0.5" />}
      <span className="tab-meta leading-relaxed" style={{ color: ok ? "hsl(142 70% 60%)" : "hsl(0 85% 65%)" }}>
        {ok ? `✓ Imported ${result.inserted} repeaters` : `Error: ${result.error}`}
      </span>
    </div>
  );
};

const KmlStatusBadge = ({ result }: { result: KmlImportResult | null }) => {
  if (!result) return null;
  const ok = !result.error;
  return (
    <div className="flex items-start gap-2 rounded-xl px-2.5 py-2 mt-2"
      style={{
        background: ok ? "hsl(142 70% 50% / 0.08)" : "hsl(0 85% 60% / 0.08)",
        border: `1px solid ${ok ? "hsl(142 70% 50% / 0.25)" : "hsl(0 85% 60% / 0.25)"}`,
      }}>
      {ok
        ? <CheckCircle2 className="tick-success h-3.5 w-3.5 mt-0.5" />
        : <XCircle className="tick-error h-3.5 w-3.5 mt-0.5" />}
      <span className="tab-meta leading-relaxed" style={{ color: ok ? "hsl(142 70% 60%)" : "hsl(0 85% 65%)" }}>
        {ok ? `✓ Updated lat/lng for ${result.updated} repeater(s)` : `Error: ${result.error}`}
      </span>
    </div>
  );
};

const CONTACTS_CSV_HEADERS = ["callsign", "name", "frequency", "freq_offset", "duplex", "tone_mode", "r_tone_freq", "c_tone_freq", "dtcs_code", "mode", "country", "region", "location_desc", "comment", "group_tag"];

function parseContactsCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else current += char;
  }
  result.push(current);
  return result;
}

const Field = ({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) => (
  <div className="flex flex-col gap-1">
    <label className="tab-meta">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="tab-input"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => (
  <div className="flex flex-col gap-1">
    <label className="tab-meta">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="tab-input"
      style={{ cursor: "pointer" }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

/* ── Location detection ── */
type LocationStatus = "idle" | "detecting" | "found" | "unsupported" | "denied" | "error" | "unrecognised";

async function detectCountry(): Promise<{ country: string }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          resolve({ country: data.countryName ?? "" });
        } catch { reject(new Error("error")); }
      },
      (err) => {
        if (err.code === 1) reject(new Error("denied"));
        else reject(new Error("error"));
      },
      { timeout: 10000 }
    );
  });
}

/* ── Main component ── */
const SettingsScreen = ({ myCallsign, onCallsignChange, captionsLang, onCaptionsLangChange }: SettingsScreenProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kmlFileInputRef = useRef<HTMLInputElement>(null);
  const contactsFileInputRef = useRef<HTMLInputElement>(null);
  const [contactsImportDone, setContactsImportDone] = useState<number | null>(null);

  // Callsign draft — only committed on Save
  const [callsignDraft, setCallsignDraft] = useState(myCallsign);
  const draftChanged = callsignDraft !== myCallsign;
  const draftValid = callsignDraft.trim().length >= 3;

  const handleSaveCallsign = () => {
    onCallsignChange(callsignDraft);
  };

  const handleExportContacts = async () => {
    const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
    const contacts = (data ?? []) as Record<string, unknown>[];
    const rows = contacts.map((c) =>
      CONTACTS_CSV_HEADERS.map((h) => {
        const val = c[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    );
    const csv = [CONTACTS_CSV_HEADERS.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportContacts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setContactsImportDone(null);
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { e.target.value = ""; return; }
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
    const records = lines.slice(1).map((line) => {
      const vals = parseContactsCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i]?.replace(/^"|"$/g, "") ?? ""; });
      return obj;
    }).filter((r) => r.frequency && !isNaN(parseFloat(r.frequency)));
    if (records.length === 0) { e.target.value = ""; return; }
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
    setContactsImportDone(records.length);
    e.target.value = "";
  };

  // Location detection
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(
    () => (localStorage.getItem("detectedCountry") ? "found" : "idle")
  );
  const [detectedCountry, setDetectedCountry] = useState<string>(
    () => localStorage.getItem("detectedCountry") ?? ""
  );

  // Initialise dropdowns from stored detection or fallback to "Australia"
  const storedCountry = localStorage.getItem("detectedCountry");
  const defaultCountry = storedCountry && COUNTRY_OPTIONS.some(o => o.value === storedCountry)
    ? storedCountry
    : "Australia";

  const [csvCountry, setCsvCountry] = useState(defaultCountry);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);

  const [kmlCountry, setKmlCountry] = useState(defaultCountry);
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [kmlOverwrite, setKmlOverwrite] = useState(false);
  const [kmlImporting, setKmlImporting] = useState(false);
  const [kmlResult, setKmlResult] = useState<KmlImportResult | null>(null);

  const [apiUrl, setApiUrl] = useState("");
  const [apiCountry, setApiCountry] = useState(defaultCountry);
  const [apiKey, setApiKey] = useState("");
  const [apiImporting, setApiImporting] = useState(false);
  const [apiResult, setApiResult] = useState<ImportResult | null>(null);

  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const applyCountry = (raw: string) => {
    const match = COUNTRY_OPTIONS.find(o => o.value.toLowerCase() === raw.toLowerCase());
    const resolved = match?.value ?? null;
    if (resolved) {
      setCsvCountry(resolved);
      setApiCountry(resolved);
      setDetectedCountry(resolved);
      localStorage.setItem("detectedCountry", resolved);
      setLocationStatus("found");
    } else {
      setDetectedCountry(raw);
      setLocationStatus("unrecognised");
    }
  };

  const handleDetect = async () => {
    setLocationStatus("detecting");
    try {
      const { country } = await detectCountry();
      applyCountry(country);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "error";
      setLocationStatus(msg as LocationStatus);
    }
  };

  // Auto-detect on first mount if never detected before
  useEffect(() => {
    if (!localStorage.getItem("detectedCountry")) {
      handleDetect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true); setCsvResult(null);
    try {
      const csvText = await csvFile.text();
      const data = await importCsvToDb(csvText, csvCountry, clearFirst);
      setCsvResult(data);
      if (!data.error) { setCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }
    } catch (err) { setCsvResult({ inserted: 0, error: String(err) }); }
    finally { setCsvImporting(false); }
  };

  const handleKmlImport = async () => {
    if (!kmlFile) return;
    setKmlImporting(true); setKmlResult(null);
    try {
      const kmlText = await kmlFile.text();
      const placemarks = parseKml(kmlText);
      if (placemarks.length === 0) {
        setKmlResult({ updated: 0, error: "No valid placemarks with coordinates found in KML." });
        return;
      }
      const { data: repeaters, error: fetchErr } = await supabase
        .from("repeaters")
        .select("id, name, callsign, lat, lng")
        .eq("country", kmlCountry);
      if (fetchErr) {
        setKmlResult({ updated: 0, error: fetchErr.message });
        return;
      }
      const list = (repeaters ?? []) as { id: string; name: string; callsign: string | null; lat: number | null; lng: number | null }[];
      const nameToPlacemark = new Map<string, { lat: number; lng: number }>();
      for (const pm of placemarks) {
        const key = pm.name.trim().toLowerCase();
        if (key) nameToPlacemark.set(key, { lat: pm.lat, lng: pm.lng });
      }
      let updated = 0;
      for (const r of list) {
        const keyName = (r.name ?? "").trim().toLowerCase();
        const keyCallsign = (r.callsign ?? "").trim().toLowerCase();
        const coords = nameToPlacemark.get(keyName) ?? (keyCallsign ? nameToPlacemark.get(keyCallsign) : undefined);
        if (!coords) continue;
        if (!kmlOverwrite && r.lat != null && r.lng != null) continue;
        const { error: updateErr } = await supabase
          .from("repeaters")
          .update({ lat: coords.lat, lng: coords.lng })
          .eq("id", r.id);
        if (!updateErr) updated++;
      }
      setKmlResult({ updated });
      if (!updated) setKmlResult((prev) => ({ ...prev!, error: "No repeaters matched KML placemark names/callsigns for this country." }));
      else { setKmlFile(null); if (kmlFileInputRef.current) kmlFileInputRef.current.value = ""; }
    } catch (err) { setKmlResult({ updated: 0, error: String(err) }); }
    finally { setKmlImporting(false); }
  };

  const handleApiImport = async () => {
    if (!apiUrl.trim()) return;
    setApiImporting(true); setApiResult(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey.trim()) headers["Authorization"] = `Bearer ${apiKey.trim()}`;
      const res = await fetch(apiUrl.trim(), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await importCsvToDb(await res.text(), apiCountry, false);
      setApiResult(data);
    } catch (err) { setApiResult({ inserted: 0, error: String(err) }); }
    finally { setApiImporting(false); }
  };

  const handleResetAll = async () => {
    setResetting(true);
    try {
      await supabase.from("repeaters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setResetDone(true);
      setShowResetConfirm(false);
      setTimeout(() => setResetDone(false), 3000);
    } catch (e) { console.error(e); }
    finally { setResetting(false); }
  };

  return (
    <div className="tab-panel flex flex-col w-full h-full animate-fade-in gap-3 overflow-y-auto overscroll-contain px-2 pt-0 pb-2">

      {/* Header */}
      <div className="tab-header flex items-center px-3 py-2.5">
        <span className="tab-section-title">SETTINGS</span>
      </div>

      {/* ── Callsign ── */}
      <Section title="MY CALLSIGN" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="tab-meta">CALLSIGN</label>
            <div className="flex items-center gap-2">
              <div
                className="relative flex items-center gap-2 flex-1 rounded-xl px-3 py-2 min-w-0"
                style={{
                  background: "linear-gradient(180deg, hsl(210 18% 12%), hsl(210 18% 9%))",
                  border: `1px solid ${draftValid ? "hsl(var(--primary) / 0.4)" : "hsl(0 80% 55% / 0.35)"}`,
                }}
              >
                <Radio className="h-3 w-3 shrink-0" style={{ color: draftValid ? "hsl(var(--primary))" : "hsl(0 80% 60%)" }} />
                <input
                  type="text"
                  value={callsignDraft}
                  onChange={e => {
                    setCallsignDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 10));
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && draftValid) handleSaveCallsign(); }}
                  placeholder="e.g. VK2ABC"
                  maxLength={10}
                  className="flex-1 bg-transparent outline-none tab-callsign tab-callsign-primary uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground min-w-0"
                  style={{
                    fontSize: "13px",
                    border: "none",
                    padding: 0,
                    paddingRight: myCallsign.trim().length >= 3 && !draftChanged ? "28px" : 0,
                  }}
                />
                {myCallsign.trim().length >= 3 && !draftChanged && (
                  <CheckCircle2 className="tick-success h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
              <button
                onClick={handleSaveCallsign}
                disabled={!draftValid || !draftChanged}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))",
                  border: "1px solid hsl(var(--primary) / 0.25)",
                  color: "hsl(var(--primary))",
                  whiteSpace: "nowrap",
                }}
              >
                <Save className="h-3 w-3" />
                <span className="tab-callsign tab-callsign-primary" style={{ fontSize: "10px" }}>SAVE</span>
              </button>
            </div>
          </div>

          {/* Warnings only — success shown as tick in callsign box */}
          {!myCallsign || myCallsign.trim().length < 3 ? (
            <div className="flex items-start gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(0 80% 55% / 0.08)", border: "1px solid hsl(0 80% 55% / 0.25)" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(0 80% 65%)" }} />
              <span className="tab-meta leading-relaxed" style={{ color: "hsl(0 80% 65%)" }}>
                A valid callsign is required before the radio can transmit or send APRS messages.
              </span>
            </div>
          ) : draftChanged ? (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(42 90% 55% / 0.08)", border: "1px solid hsl(42 90% 55% / 0.25)" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(42 90% 65%)" }} />
              <span className="tab-meta" style={{ color: "hsl(42 90% 65%)" }}>
                Unsaved changes — press SAVE to apply.
              </span>
            </div>
          ) : null}
        </div>
      </Section>

      {/* ── Closed Captions ── */}
      <Section title="CLOSED CAPTIONS" defaultOpen={false}>
        <SelectField
          label="SPEECH LANGUAGE"
          value={captionsLang}
          onChange={onCaptionsLangChange}
          options={[
            { value: "en-US", label: "🇺🇸 English (US)" },
            { value: "en-GB", label: "🇬🇧 English (UK)" },
            { value: "en-AU", label: "🇦🇺 English (Australia)" },
            { value: "en-CA", label: "🇨🇦 English (Canada)" },
            { value: "en-NZ", label: "🇳🇿 English (New Zealand)" },
            { value: "en-ZA", label: "🇿🇦 English (South Africa)" },
            { value: "fr-FR", label: "🇫🇷 French" },
            { value: "de-DE", label: "🇩🇪 German" },
            { value: "es-ES", label: "🇪🇸 Spanish (Spain)" },
            { value: "es-US", label: "🇺🇸 Spanish (US)" },
            { value: "it-IT", label: "🇮🇹 Italian" },
            { value: "nl-NL", label: "🇳🇱 Dutch" },
            { value: "pt-BR", label: "🇧🇷 Portuguese (Brazil)" },
            { value: "pt-PT", label: "🇵🇹 Portuguese (Portugal)" },
            { value: "ja-JP", label: "🇯🇵 Japanese" },
            { value: "zh-CN", label: "🇨🇳 Chinese (Mandarin)" },
            { value: "ko-KR", label: "🇰🇷 Korean" },
          ]}
        />
        <p className="tab-meta mt-2 opacity-60 leading-relaxed">
          Matching your locale improves recognition accuracy for regional accents and pronunciation.
        </p>
      </Section>

      {/* ── Contacts (Import / Export) ── */}
      <Section title="CONTACTS" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <p className="tab-meta opacity-80">Export or import your contacts as CSV.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportContacts}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all"
              style={{
                background: "linear-gradient(180deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.07))",
                border: "1px solid hsl(var(--primary) / 0.25)",
                color: "hsl(var(--primary))",
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="tab-callsign tab-callsign-primary">EXPORT</span>
            </button>
            <button
              onClick={() => contactsFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 transition-all"
              style={{
                background: "linear-gradient(180deg, hsl(210 18% 18%), hsl(210 18% 12%))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="tab-callsign">IMPORT</span>
            </button>
            <input ref={contactsFileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportContacts} />
          </div>
          {contactsImportDone !== null && (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(142 70% 50% / 0.08)", border: "1px solid hsl(142 70% 50% / 0.25)" }}>
              <CheckCircle2 className="tick-success h-3.5 w-3.5" />
              <span className="tab-meta" style={{ color: "hsl(142 70% 60%)" }}>Imported {contactsImportDone} contacts.</span>
            </div>
          )}
        </div>
      </Section>

      {/* ── Location ── */}
      <Section title="MY LOCATION" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          {locationStatus === "detecting" && (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(var(--primary) / 0.06)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: "hsl(var(--primary))" }} />
              <span className="tab-meta" style={{ color: "hsl(var(--primary))" }}>Detecting your location…</span>
            </div>
          )}
          {locationStatus === "found" && (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(142 70% 50% / 0.08)", border: "1px solid hsl(142 70% 50% / 0.25)" }}>
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 50%)" }} />
              <span className="tab-meta" style={{ color: "hsl(142 70% 60%)" }}>
                Detected: <strong style={{ color: "hsl(142 70% 72%)" }}>{detectedCountry}</strong> — import dropdowns updated.
              </span>
            </div>
          )}
          {locationStatus === "unrecognised" && (
            <div className="flex items-start gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(42 90% 55% / 0.08)", border: "1px solid hsl(42 90% 55% / 0.25)" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(42 90% 65%)" }} />
              <span className="tab-meta leading-relaxed" style={{ color: "hsl(42 90% 65%)" }}>
                Located in <strong>{detectedCountry}</strong> — not in the supported list. Please select your country manually below.
              </span>
            </div>
          )}
          {locationStatus === "denied" && (
            <div className="flex items-start gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(0 80% 55% / 0.08)", border: "1px solid hsl(0 80% 55% / 0.25)" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(0 80% 65%)" }} />
              <span className="tab-meta leading-relaxed" style={{ color: "hsl(0 80% 65%)" }}>
                Location access denied. Allow location access in your browser settings, then tap Detect again.
              </span>
            </div>
          )}
          {(locationStatus === "error" || locationStatus === "unsupported") && (
            <div className="flex items-start gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(0 80% 55% / 0.08)", border: "1px solid hsl(0 80% 55% / 0.25)" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(0 80% 65%)" }} />
              <span className="tab-meta leading-relaxed" style={{ color: "hsl(0 80% 65%)" }}>
                {locationStatus === "unsupported"
                  ? "Geolocation is not supported by this browser."
                  : "Could not determine location. Please select your country manually below."}
              </span>
            </div>
          )}
          {locationStatus === "idle" && (
            <p className="tab-meta leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              Automatically detect your country to pre-fill the import dropdowns.
            </p>
          )}
          <button
            onClick={handleDetect}
            disabled={locationStatus === "detecting"}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))",
              border: "1px solid hsl(var(--primary) / 0.25)",
              color: "hsl(var(--primary))",
            }}
          >
            {locationStatus === "detecting"
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : locationStatus === "found"
              ? <RefreshCw className="h-3 w-3" />
              : <MapPin className="h-3 w-3" />}
            <span className="tab-callsign tab-callsign-primary">
              {locationStatus === "found" ? "RE-DETECT LOCATION" : "DETECT MY LOCATION"}
            </span>
          </button>
        </div>
      </Section>

      {/* ── CSV Upload ── */}
      <Section title="IMPORT CSV (CHIRP FORMAT)" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <SelectField label="COUNTRY / REGION" value={csvCountry} onChange={setCsvCountry} options={COUNTRY_OPTIONS} />
          <div className="flex flex-col gap-1">
            <label className="tab-meta">CSV FILE</label>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer"
              style={{
                background: "linear-gradient(180deg, hsl(210 18% 12%), hsl(210 18% 9%))",
                border: `1px solid ${csvFile ? "hsl(var(--primary) / 0.4)" : "hsl(210 15% 20% / 0.5)"}`,
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 shrink-0" style={{ color: csvFile ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
              <span className="tab-body flex-1 truncate text-sm" style={{ color: csvFile ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                {csvFile ? csvFile.name : "Tap to select .csv file…"}
              </span>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setCsvResult(null); }} />
          </div>
          <button
            onClick={handleCsvImport}
            disabled={!csvFile || csvImporting}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))",
              border: "1px solid hsl(var(--primary) / 0.4)",
              color: "hsl(var(--primary))",
            }}
          >
            {csvImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span className="tab-callsign tab-callsign-primary" style={{ fontSize: "13px" }}>{csvImporting ? "IMPORTING…" : "IMPORT CSV"}</span>
          </button>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setClearFirst(v => !v)}>
              <div
                className="relative rounded-full transition-all shrink-0"
                style={{
                  width: "28px", height: "16px",
                  background: clearFirst ? "hsl(var(--primary) / 0.7)" : "hsl(210 12% 32%)",
                  border: `1px solid ${clearFirst ? "hsl(var(--primary) / 0.9)" : "hsl(210 10% 42%)"}`,
                }}
              >
                <div className="absolute top-[2px] rounded-full transition-all"
                  style={{ width: "10px", height: "10px", background: "hsl(var(--foreground))", left: clearFirst ? "14px" : "2px" }} />
              </div>
              <span className="tab-meta">Replace existing data for this country</span>
            </label>
            <p className="tab-meta leading-relaxed pl-9" style={{ color: clearFirst ? "hsl(0 80% 65%)" : "hsl(var(--muted-foreground))", opacity: 0.85 }}>
              {clearFirst
                ? "⚠️ All existing records for this country will be deleted before import. For US imports, add states one-by-one with this OFF."
                : "New records will be added alongside existing data. Use this when importing multiple files for the same country (e.g. US state-by-state)."}
            </p>
          </div>
          <StatusBadge result={csvResult} />
        </div>
      </Section>

      {/* ── KML Import (Google Maps) ── */}
      <Section title="IMPORT KML (GOOGLE MAPS)" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <p className="tab-meta opacity-80">Import lat/lng from a Google Maps .kml file. Placemark names are matched to repeater name or callsign for the selected country.</p>
          <SelectField label="COUNTRY / REGION" value={kmlCountry} onChange={setKmlCountry} options={COUNTRY_OPTIONS} />
          <div className="flex flex-col gap-1">
            <label className="tab-meta">KML FILE</label>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer"
              style={{
                background: "linear-gradient(180deg, hsl(210 18% 12%), hsl(210 18% 9%))",
                border: `1px solid ${kmlFile ? "hsl(var(--primary) / 0.4)" : "hsl(210 15% 20% / 0.5)"}`,
              }}
              onClick={() => kmlFileInputRef.current?.click()}
            >
              <Map className="h-3 w-3 shrink-0" style={{ color: kmlFile ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
              <span className="tab-body flex-1 truncate text-sm" style={{ color: kmlFile ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
                {kmlFile ? kmlFile.name : "Tap to select .kml file…"}
              </span>
            </div>
            <input ref={kmlFileInputRef} type="file" accept=".kml,application/vnd.google-earth.kml+xml" className="hidden"
              onChange={e => { setKmlFile(e.target.files?.[0] ?? null); setKmlResult(null); }} />
          </div>
          <button
            onClick={handleKmlImport}
            disabled={!kmlFile || kmlImporting}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))",
              border: "1px solid hsl(var(--primary) / 0.4)",
              color: "hsl(var(--primary))",
            }}
          >
            {kmlImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Map className="h-3.5 w-3.5" />}
            <span className="tab-callsign tab-callsign-primary" style={{ fontSize: "13px" }}>{kmlImporting ? "IMPORTING…" : "IMPORT KML"}</span>
          </button>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setKmlOverwrite(v => !v)}>
              <div
                className="relative rounded-full transition-all shrink-0"
                style={{
                  width: "28px", height: "16px",
                  background: kmlOverwrite ? "hsl(var(--primary) / 0.7)" : "hsl(210 12% 32%)",
                  border: `1px solid ${kmlOverwrite ? "hsl(var(--primary) / 0.9)" : "hsl(210 10% 42%)"}`,
                }}
              >
                <div className="absolute top-[2px] rounded-full transition-all"
                  style={{ width: "10px", height: "10px", background: "hsl(var(--foreground))", left: kmlOverwrite ? "14px" : "2px" }} />
              </div>
              <span className="tab-meta">Overwrite existing lat/lng</span>
            </label>
            <p className="tab-meta leading-relaxed pl-9" style={{ color: kmlOverwrite ? "hsl(0 80% 65%)" : "hsl(var(--muted-foreground))", opacity: 0.85 }}>
              {kmlOverwrite
                ? "Repeaters that already have coordinates will be updated from the KML."
                : "Only repeaters with no lat/lng set will be updated. Existing coordinates are left unchanged."}
            </p>
          </div>
          <KmlStatusBadge result={kmlResult} />
        </div>
      </Section>

      {/* ── API Import ── */}
      <Section title="IMPORT FROM API / URL" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <SelectField label="COUNTRY / REGION" value={apiCountry} onChange={setApiCountry} options={COUNTRY_OPTIONS} />
          <Field label="DATA URL (must return CHIRP CSV)" value={apiUrl} onChange={setApiUrl} placeholder="https://repeaterbook.com/export/…" />
          <Field label="API KEY (optional)" value={apiKey} onChange={setApiKey} placeholder="Bearer token or API key" type="password" />
          <button
            onClick={handleApiImport}
            disabled={!apiUrl.trim() || apiImporting}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))",
              border: "1px solid hsl(var(--primary) / 0.4)",
              color: "hsl(var(--primary))",
            }}
          >
            {apiImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            <span className="tab-callsign tab-callsign-primary" style={{ fontSize: "13px" }}>{apiImporting ? "FETCHING…" : "FETCH & IMPORT"}</span>
          </button>
          <StatusBadge result={apiResult} />
        </div>
      </Section>

      {/* ── Danger Zone ── */}
      <Section title="DANGER ZONE" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <p className="tab-body leading-relaxed">
            Permanently delete all repeater data from the database. This cannot be undone.
          </p>
          {resetDone && (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(142 70% 50% / 0.08)", border: "1px solid hsl(142 70% 50% / 0.25)" }}>
              <CheckCircle2 className="tick-success h-3.5 w-3.5" />
              <span className="tab-meta" style={{ color: "hsl(142 70% 60%)" }}>All repeater data has been deleted.</span>
            </div>
          )}
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(0 60% 28%), hsl(0 55% 18%))",
              border: "1px solid hsl(0 60% 32%)",
              color: "hsl(0 80% 75%)",
            }}
          >
            {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            <span className="tab-callsign">RESET ALL USER DATA</span>
          </button>
        </div>
      </Section>

      {/* ── Reset Confirmation Dialog ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "hsl(0 0% 0% / 0.7)" }}
          onClick={() => setShowResetConfirm(false)}>
          <div
            className="flex flex-col gap-4 rounded-2xl p-5 w-full max-w-xs"
            style={{
              background: "hsl(210 18% 10%)",
              border: "1px solid hsl(0 60% 32%)",
              boxShadow: "0 20px 60px hsl(0 0% 0% / 0.6)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl p-2 shrink-0" style={{ background: "hsl(0 60% 28% / 0.3)", border: "1px solid hsl(0 60% 32%)" }}>
                <AlertTriangle className="h-4 w-4" style={{ color: "hsl(0 80% 70%)" }} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="tab-callsign" style={{ color: "hsl(0 80% 75%)" }}>RESET ALL USER DATA</span>
                <p className="tab-meta leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  This will permanently delete <strong style={{ color: "hsl(var(--foreground))" }}>all repeaters</strong> from the database. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-xl py-2 tab-callsign transition-all"
                style={{
                  background: "hsl(var(--secondary))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleResetAll}
                disabled={resetting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, hsl(0 60% 32%), hsl(0 55% 22%))",
                  border: "1px solid hsl(0 60% 38%)",
                  color: "hsl(0 80% 80%)",
                }}
              >
                {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                <span className="tab-callsign">DELETE ALL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
