#!/usr/bin/env node
/**
 * Test Supabase read/write for qrpmobile (post URL-migration).
 * Run: node /tmp/test-supabase-qrpmobile.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envPath = "/var/www/html/sites/qrpmobile.vk4cgo.com/.env";
const content = readFileSync(envPath, "utf8");
const env = {};
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("Supabase URL:", url);

  const { data: repeaters, error: readErr } = await supabase
    .from("repeaters")
    .select("id, country, name")
    .limit(2);

  if (readErr) {
    console.error("READ (repeaters): FAIL –", readErr.message);
    process.exit(1);
  }
  console.log("READ (repeaters): OK – rows:", repeaters?.length ?? 0);
  if (repeaters?.length) console.log("  Sample:", repeaters[0]);

  const testId = crypto.randomUUID();
  const { error: upsertErr } = await supabase.from("user_locations").upsert(
    { id: testId, callsign: "SUPABASE_TEST", lat: 0, lng: 0 },
    { onConflict: "id" }
  );

  if (upsertErr) {
    console.error("WRITE (user_locations upsert): FAIL –", upsertErr.message);
    process.exit(1);
  }
  console.log("WRITE (user_locations upsert): OK – id:", testId);

  await supabase.from("user_locations").delete().eq("id", testId);
  console.log("CLEANUP: test row removed");
  console.log("\nSupabase read and write OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
