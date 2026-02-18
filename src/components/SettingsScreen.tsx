import { useState, useRef, useEffect } from "react";
import {
  Upload, Trash2, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronRight, Globe, AlertTriangle, Radio, Save, MapPin, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportResult { inserted: number; total?: number; error?: string; }

interface SettingsScreenProps {
  myCallsign: string;
  onCallsignChange: (value: string) => void;
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
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(142 70% 50%)" }} />
        : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(0 85% 60%)" }} />}
      <span className="tab-meta leading-relaxed" style={{ color: ok ? "hsl(142 70% 60%)" : "hsl(0 85% 65%)" }}>
        {ok ? `✓ Imported ${result.inserted} repeaters` : `Error: ${result.error}`}
      </span>
    </div>
  );
};

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
const SettingsScreen = ({ myCallsign, onCallsignChange }: SettingsScreenProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Callsign draft — only committed on Save
  const [callsignDraft, setCallsignDraft] = useState(myCallsign);
  const [callsignSaved, setCallsignSaved] = useState(false);
  const draftChanged = callsignDraft !== myCallsign;
  const draftValid = callsignDraft.trim().length >= 3;

  const handleSaveCallsign = () => {
    onCallsignChange(callsignDraft);
    setCallsignSaved(true);
    setTimeout(() => setCallsignSaved(false), 2500);
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
    <div className="tab-panel flex flex-col w-full h-full animate-fade-in gap-3 overflow-y-auto overscroll-contain px-2 py-2">

      {/* Header */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5 rounded-xl">
        <span className="tab-section-title">SETTINGS</span>
        <span className="tab-meta">REPEATER DATABASE</span>
      </div>

      {/* ── Callsign ── */}
      <Section title="MY CALLSIGN" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="tab-meta">CALLSIGN</label>
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2"
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
                    setCallsignSaved(false);
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && draftValid) handleSaveCallsign(); }}
                  placeholder="e.g. VK2ABC"
                  maxLength={10}
                  className="flex-1 bg-transparent outline-none tab-callsign tab-callsign-primary uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground"
                  style={{ fontSize: "13px", border: "none", padding: 0 }}
                />
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

          {/* Status feedback */}
          {callsignSaved ? (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(142 70% 50% / 0.08)", border: "1px solid hsl(142 70% 50% / 0.25)" }}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 50%)" }} />
              <span className="tab-meta" style={{ color: "hsl(142 70% 60%)" }}>
                Callsign saved — radio functions are enabled.
              </span>
            </div>
          ) : !myCallsign || myCallsign.trim().length < 3 ? (
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
          ) : (
            <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
              style={{ background: "hsl(142 70% 50% / 0.08)", border: "1px solid hsl(142 70% 50% / 0.25)" }}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 50%)" }} />
              <span className="tab-meta" style={{ color: "hsl(142 70% 60%)" }}>
                Callsign set — radio functions are enabled.
              </span>
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
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer" onClick={() => setClearFirst(v => !v)}>
              <div
                className="relative rounded-full transition-all shrink-0"
                style={{
                  width: "28px", height: "16px",
                  background: clearFirst ? "hsl(var(--primary) / 0.7)" : "hsl(var(--secondary))",
                  border: `1px solid ${clearFirst ? "hsl(var(--primary) / 0.9)" : "hsl(var(--border))"}`,
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
          <button
            onClick={handleCsvImport}
            disabled={!csvFile || csvImporting}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))",
              border: "1px solid hsl(var(--primary) / 0.25)",
              color: "hsl(var(--primary))",
            }}
          >
            {csvImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            <span className="tab-callsign tab-callsign-primary">{csvImporting ? "IMPORTING…" : "IMPORT CSV"}</span>
          </button>
          <StatusBadge result={csvResult} />
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
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(270 60% 28%), hsl(270 50% 18%))",
              border: "1px solid hsl(270 60% 32%)",
              color: "hsl(270 80% 80%)",
            }}
          >
            {apiImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
            <span className="tab-callsign">{apiImporting ? "FETCHING…" : "FETCH & IMPORT"}</span>
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
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 50%)" }} />
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
