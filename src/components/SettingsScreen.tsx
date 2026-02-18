import { useState, useRef } from "react";
import {
  Upload, Database, Trash2, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronRight, RefreshCw, Globe, PackageOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImportResult { inserted: number; total?: number; error?: string; }
interface DbStats { total: number; byCountry: { country: string; count: number }[]; }

const EDGE_FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/import-chirp-csv`;

async function importCsvToDb(csvText: string, country: string, clearFirst = false): Promise<ImportResult> {
  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csvText, country, clearFirst }),
  });
  return res.json();
}

const BUNDLED_DATASETS = [
  { file: "/data/RepeaterBook-US-Florida.csv", country: "United States", label: "🇺🇸 US Florida" },
  { file: "/data/RepeaterBook-UK.csv",         country: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { file: "/data/RepeaterBook-Australia.csv",  country: "Australia",      label: "🇦🇺 Australia" },
];

const COUNTRY_OPTIONS = [
  { value: "United States",  label: "🇺🇸 United States" },
  { value: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { value: "Australia",      label: "🇦🇺 Australia" },
  { value: "Canada",         label: "🇨🇦 Canada" },
  { value: "Germany",        label: "🇩🇪 Germany" },
  { value: "Japan",          label: "🇯🇵 Japan" },
  { value: "New Zealand",    label: "🇳🇿 New Zealand" },
  { value: "Other",          label: "🌍 Other" },
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

/* ── Main component ── */
const SettingsScreen = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bundledResults, setBundledResults] = useState<Record<string, ImportResult | null>>({});
  const [bundledLoading, setBundledLoading] = useState<Record<string, boolean>>({});

  const [csvCountry, setCsvCountry] = useState("United States");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);

  const [apiUrl, setApiUrl] = useState("");
  const [apiCountry, setApiCountry] = useState("United States");
  const [apiKey, setApiKey] = useState("");
  const [apiImporting, setApiImporting] = useState(false);
  const [apiResult, setApiResult] = useState<ImportResult | null>(null);

  const [stats, setStats] = useState<DbStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [deleteCountry, setDeleteCountry] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const { count } = await supabase.from("repeaters").select("*", { count: "exact", head: true });
      const { data: rows } = await supabase.from("repeaters").select("country");
      const map: Record<string, number> = {};
      (rows ?? []).forEach(r => { map[r.country] = (map[r.country] ?? 0) + 1; });
      const byCountry = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([country, count]) => ({ country, count }));
      setStats({ total: count ?? 0, byCountry });
    } catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  };

  const handleBundledImport = async (file: string, country: string) => {
    setBundledLoading(p => ({ ...p, [file]: true }));
    setBundledResults(p => ({ ...p, [file]: null }));
    try {
      const csvText = await (await fetch(file)).text();
      const data = await importCsvToDb(csvText, country, true);
      setBundledResults(p => ({ ...p, [file]: data }));
      if (!data.error) loadStats();
    } catch (err) {
      setBundledResults(p => ({ ...p, [file]: { inserted: 0, error: String(err) } }));
    } finally {
      setBundledLoading(p => ({ ...p, [file]: false }));
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true); setCsvResult(null);
    try {
      const csvText = await csvFile.text();
      const data = await importCsvToDb(csvText, csvCountry, clearFirst);
      setCsvResult(data);
      if (!data.error) { setCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; loadStats(); }
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
      if (!data.error) loadStats();
    } catch (err) { setApiResult({ inserted: 0, error: String(err) }); }
    finally { setApiImporting(false); }
  };

  const handleDelete = async () => {
    if (!deleteCountry) return;
    setDeleting(true);
    try {
      await supabase.from("repeaters").delete().eq("country", deleteCountry);
      setDeleteCountry(""); loadStats();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  return (
    <div className="tab-panel flex flex-col w-full h-full animate-fade-in gap-3 overflow-y-auto overscroll-contain px-2 py-2">

      {/* Header */}
      <div className="tab-header flex items-center justify-between px-3 py-2.5 rounded-xl">
        <span className="tab-section-title">SETTINGS</span>
        <span className="tab-meta">REPEATER DATABASE</span>
      </div>

      {/* ── Bundled Datasets ── */}
      <Section title="BUNDLED DATASETS">
        <div className="flex flex-col gap-2">
          <p className="tab-body leading-relaxed">
            One-click import from the CSV files you uploaded. Replaces existing data for each country.
          </p>
          {BUNDLED_DATASETS.map(({ file, country, label }) => (
            <div key={file} className="flex flex-col gap-1">
              <button
                onClick={() => handleBundledImport(file, country)}
                disabled={!!bundledLoading[file]}
                className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-all disabled:opacity-50"
                style={{
                  background: "hsl(var(--primary) / 0.07)",
                  border: "1px solid hsl(var(--primary) / 0.2)",
                  color: "hsl(var(--primary))",
                }}
              >
                <div className="flex items-center gap-2">
                  {bundledLoading[file]
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <PackageOpen className="h-3 w-3" />}
                  <span className="tab-callsign tab-callsign-primary">{label}</span>
                </div>
                <span className="tab-meta opacity-60">IMPORT →</span>
              </button>
              <StatusBadge result={bundledResults[file] ?? null} />
            </div>
          ))}
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
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className="relative rounded-full transition-all"
              style={{
                width: "28px", height: "16px",
                background: clearFirst ? "hsl(var(--primary) / 0.7)" : "hsl(var(--secondary))",
                border: `1px solid ${clearFirst ? "hsl(var(--primary) / 0.9)" : "hsl(var(--border))"}`,
              }}
              onClick={() => setClearFirst(v => !v)}
            >
              <div className="absolute top-[2px] rounded-full transition-all"
                style={{ width: "10px", height: "10px", background: "hsl(var(--foreground))", left: clearFirst ? "14px" : "2px" }} />
            </div>
            <span className="tab-meta">Replace existing data for this country</span>
          </label>
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

      {/* ── DB Stats ── */}
      <Section title="DATABASE STATS" defaultOpen={false}>
        <div className="flex flex-col gap-3">
          <button
            onClick={loadStats}
            disabled={statsLoading}
            className="tab-icon-btn self-start flex items-center gap-1.5 px-2.5 py-1.5"
          >
            {statsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="tab-meta">REFRESH STATS</span>
          </button>
          {stats && (
            <div className="flex flex-col gap-2">
              <div className="tab-card flex items-center justify-between px-2.5 py-2"
                style={{ background: "hsl(var(--primary) / 0.07)", border: "1px solid hsl(var(--primary) / 0.18)" }}>
                <div className="flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-primary" />
                  <span className="tab-callsign tab-callsign-primary">TOTAL REPEATERS</span>
                </div>
                <span className="tab-callsign tab-callsign-primary">{stats.total.toLocaleString()}</span>
              </div>
              {stats.byCountry.map(({ country, count }) => (
                <div key={country} className="tab-card flex items-center justify-between px-2.5 py-1.5">
                  <span className="tab-body">{country}</span>
                  <span className="tab-callsign tab-callsign-primary">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Danger Zone ── */}
      <Section title="DANGER ZONE" defaultOpen={false}>
        <div className="flex flex-col gap-2.5">
          <p className="tab-body leading-relaxed">Delete all repeaters for a specific country.</p>
          <SelectField
            label="SELECT COUNTRY TO DELETE"
            value={deleteCountry}
            onChange={setDeleteCountry}
            options={[{ value: "", label: "— Select country —" }, ...COUNTRY_OPTIONS]}
          />
          <button
            onClick={handleDelete}
            disabled={!deleteCountry || deleting}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, hsl(0 60% 28%), hsl(0 55% 18%))",
              border: "1px solid hsl(0 60% 32%)",
              color: "hsl(0 80% 75%)",
            }}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            <span className="tab-callsign">DELETE {deleteCountry ? deleteCountry.toUpperCase() : "SELECTED"} REPEATERS</span>
          </button>
        </div>
      </Section>
    </div>
  );
};

export default SettingsScreen;
