# KV4P-Radio Wi‑Fi vs internet — field guide and QA matrix

The radio connects over **local LAN** (WebSocket to the board, e.g. `192.168.x.x:8765`). The `KV4P-Radio` access point usually has **no route to the internet**. Cloud features (Supabase repeater directory, OpenStreetMap tiles, Settings imports, location sync) use **HTTPS** and need a **separate internet path** from the phone—almost always **cellular** while the handset stays joined to `KV4P-Radio`.

---

## Team standard — iPhone (field operations)

**This is the expected configuration for all teams using iPhones in the field.**

1. **Keep cellular data on** for the device, and ensure **QRP Mobile is allowed to use cellular data** (iOS **Settings → Cellular** / **Mobile Data**, and **Settings → [QRP Mobile]** — enable **Cellular Data** for the app if listed).
2. After joining **KV4P-Radio**, if iOS prompts to **use cellular data** when the network has no internet (e.g. “Use Cellular Data for [network]?” / similar), choose **Yes** / **Allow** so the app can reach the internet **while staying on the radio Wi‑Fi** for the board link.
3. **Do not** rely on KV4P-Radio alone for maps or the repeater browser: that SSID does not carry public internet. Cellular is what keeps data **current**.

**Why this matters**

| Need | Uses internet? | Without cellular (on KV4P-Radio only) |
|------|----------------|--------------------------------------|
| **Repeater directory** (Contacts → Repeaters) | Yes — live data from Supabase | Stale or empty beyond offline cache |
| **Map basemap** (OpenStreetMap tiles) | Yes — tile CDN | No new tiles; coordinate fallback only |
| **My List sync, Settings cloud imports** | Yes — Supabase / Edge / APIs | Cannot refresh or import until online |
| **Voice / radio over Wi‑Fi** | No — LAN WebSocket only | Still works on KV4P-Radio |

**Policy intent:** teams should **always** operate iPhones with the above so they have the **most up-to-date local repeater listings** and **live map tiles** whenever coverage allows, without giving up the **KV4P-Radio** link to the hardware.

---

## Field guidance (summary)

1. Join **KV4P-Radio** for voice and data to the board.
2. Treat **cellular + allow prompts** as **normal and required** for iPhone field use—not optional—when you need fresh repeaters and maps.
3. If iOS asks about a Wi‑Fi network **without internet**, prefer options that **keep using that Wi‑Fi** for local devices **and** allow **cellular for internet** (wording varies by iOS version; test on your fleet devices).
4. **USB/BLE** to the radio avoids the “no internet on this Wi‑Fi” constraint for the **radio link** only; cloud features still need internet when you use them.

---

## QA matrix (fill in on real hardware)

Run each row on **iPhone** (or primary target device). Mark **Pass / Fail / N/A**.

**Row 1 is the target production setup for iPhone teams** (KV4P-Radio + cellular allowed as above).

| # | Condition | Voice tab + Wi‑Fi radio audio | Contacts → My List (Supabase) | Contacts → Repeaters (Supabase) | Map basemap (OSM tiles) | Map location dot (GPS) | Settings → cloud import / detect country |
|---|-----------|------------------------------|-------------------------------|-----------------------------------|-------------------------|-------------------------|------------------------------------------|
| 1 | Cellular **ON** (app allowed), Wi‑Fi = **KV4P-Radio** only; **accept** “use cellular” if prompted | | | | | | |
| 2 | Cellular **OFF**, Wi‑Fi = **KV4P-Radio** only | | | | | | |
| 3 | Cellular **ON**, Wi‑Fi = **home internet** + radio on USB/BLE (if available) | | | | | | |

**Expected (typical iOS, not guaranteed):** Row 1 should pass all columns: WebSocket stays on Wi‑Fi; HTTPS (Supabase, tiles) uses cellular. Row 2: voice/radio and GPS may still work; cloud and tiles usually **fail** or fall back to cache. Row 3: internet via Wi‑Fi; all cloud features should work.

---

## App mitigations (implemented in codebase)

- **Banners** on Map, Contacts, and Settings when the browser reports offline or when cloud/tile requests fail (radio may still work).
- **Bundled Leaflet marker icons** so the map does not depend on `unpkg` when tiles are the only missing piece.
- **IndexedDB cache** for contacts and last repeater snapshot: local-first display when the network path to Supabase is down (does not replace live data when online).
- **Map fallback**: coordinate readout when basemap tiles cannot load (no MBTiles bundle required).

---

## Notes column

Use this space during QA:

```
Date:
Device / iOS:
Row 1 notes:
Row 2 notes:
Row 3 notes:
```
