import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

interface ChirpRow {
  location_index: number;
  name: string;
  frequency: number;
  duplex: string;
  freq_offset: number;
  tone_mode: string;
  r_tone_freq: number;
  c_tone_freq: number;
  dtcs_code: string;
  dtcs_polarity: string;
  rx_dtcs_code: string;
  cross_mode: string;
  mode: string;
  t_step: number;
  skip: string;
  power: string;
  comment: string;
  callsign: string | null;
  location_desc: string | null;
  country: string;
  region: string | null;
  source: string;
}

/** Parse callsign, location, and region from CHIRP comment field.
 *  Format: "CALLSIGN near LOCATION, REGION ACCESS_TYPE"
 *  e.g.   "WR4AYC near Parkland, Broward County, Florida OPEN"
 */
function parseComment(comment: string): {
  callsign: string | null;
  locationDesc: string | null;
  region: string | null;
} {
  if (!comment) return { callsign: null, locationDesc: null, region: null };

  // callsign is the first word before " near "
  const nearIdx = comment.indexOf(" near ");
  const callsign = nearIdx > 0 ? comment.slice(0, nearIdx).trim() : null;

  // everything after " near " up to the access type keyword
  const afterNear = nearIdx > 0 ? comment.slice(nearIdx + 6) : comment;
  const accessWords = ["OPEN", "CLOSED", "PRIVATE", "LINKED", "Connected"];
  let locationPart = afterNear;
  for (const word of accessWords) {
    const idx = locationPart.indexOf(word);
    if (idx > 0) {
      locationPart = locationPart.slice(0, idx).trim();
      break;
    }
  }

  // region = last comma-separated segment (e.g. "Florida", "South Yorkshire")
  const parts = locationPart.split(",").map((s) => s.trim()).filter(Boolean);
  const region = parts.length > 1 ? parts[parts.length - 1] : null;
  const locationDesc = locationPart || null;

  return { callsign, locationDesc, region };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(csvText: string, country: string): ChirpRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // skip header row
  const rows: ChirpRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 17) continue;

    const [
      locationRaw,
      name,
      frequencyRaw,
      duplex,
      freqOffsetRaw,
      toneMode,
      rToneFreqRaw,
      cToneFreqRaw,
      dtcsCode,
      dtcsPolarity,
      rxDtcsCode,
      crossMode,
      mode,
      tStepRaw,
      skip,
      power,
      comment,
    ] = cols;

    const frequency = parseFloat(frequencyRaw);
    if (isNaN(frequency)) continue;

    const { callsign, locationDesc, region } = parseComment(comment?.trim() ?? "");

    rows.push({
      location_index: parseInt(locationRaw, 10) || 0,
      name: name?.trim() || "",
      frequency,
      duplex: duplex?.trim() ?? "",
      freq_offset: parseFloat(freqOffsetRaw) || 0,
      tone_mode: toneMode?.trim() ?? "",
      r_tone_freq: parseFloat(rToneFreqRaw) || 88.5,
      c_tone_freq: parseFloat(cToneFreqRaw) || 88.5,
      dtcs_code: dtcsCode?.trim() ?? "023",
      dtcs_polarity: dtcsPolarity?.trim() ?? "NN",
      rx_dtcs_code: rxDtcsCode?.trim() ?? "023",
      cross_mode: crossMode?.trim() ?? "Tone->Tone",
      mode: mode?.trim() ?? "FM",
      t_step: parseFloat(tStepRaw) || 5.0,
      skip: skip?.trim() ?? "",
      power: power?.trim() ?? "50W",
      comment: comment?.trim() ?? "",
      callsign,
      location_desc: locationDesc,
      country,
      region,
      source: "csv",
    });
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { csvText, country, clearFirst } = body as {
      csvText: string;
      country: string;
      clearFirst?: boolean;
    };

    if (!csvText || !country) {
      return new Response(
        JSON.stringify({ error: "csvText and country are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally clear existing rows for this country first
    if (clearFirst) {
      const { error: deleteError } = await supabase
        .from("repeaters")
        .delete()
        .eq("country", country);
      if (deleteError) throw deleteError;
    }

    const rows = parseCsv(csvText, country);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, message: "No valid rows found in CSV" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch insert in chunks of 500 to avoid payload limits
    const CHUNK = 500;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("repeaters").insert(chunk);
      if (error) throw error;
      totalInserted += chunk.length;
    }

    return new Response(
      JSON.stringify({ inserted: totalInserted, total: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("import-chirp-csv error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
