/**
 * IndexedDB cache for Supabase-backed lists so Contacts / Repeaters stay usable
 * when the device has no path to the internet (e.g. only KV4P-Radio Wi‑Fi).
 */

const DB_NAME = "qrpmobile_cloud_cache";
const DB_VERSION = 1;
const STORE = "kv";

const KEY_CONTACTS = "contacts_v1";
const KEY_REPEATER_COUNTRIES = "repeater_countries_v1";

export function repeaterSnapshotKey(filterKey: string): string {
  return `repeaters_v1_${filterKey}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

async function kvGet(key: string): Promise<string | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as string | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function getCachedContactsJson(): Promise<string | undefined> {
  return kvGet(KEY_CONTACTS);
}

export async function setCachedContactsJson(json: string): Promise<void> {
  await kvSet(KEY_CONTACTS, json);
}

export async function getCachedRepeaterCountriesJson(): Promise<string | undefined> {
  return kvGet(KEY_REPEATER_COUNTRIES);
}

export async function setCachedRepeaterCountriesJson(json: string): Promise<void> {
  await kvSet(KEY_REPEATER_COUNTRIES, json);
}

export async function getCachedRepeaterSnapshotJson(filterKey: string): Promise<string | undefined> {
  return kvGet(repeaterSnapshotKey(filterKey));
}

export async function setCachedRepeaterSnapshotJson(filterKey: string, json: string): Promise<void> {
  await kvSet(repeaterSnapshotKey(filterKey), json);
}

/** Build a stable key for the current repeater query (page 0 snapshot only). */
export function buildRepeaterFilterKey(parts: {
  query: string;
  selectedCountry: string | null;
  selectedMode: string | null;
  boardBand: string | null;
}): string {
  return [parts.query.trim(), parts.selectedCountry ?? "", parts.selectedMode ?? "", parts.boardBand ?? ""].join("|");
}
