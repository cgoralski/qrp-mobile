# KV4P-Radio Wi‑Fi vs internet — field guide and QA matrix

The radio connects over **local LAN** (WebSocket to the board, e.g. `192.168.x.x:8765`). The `KV4P-Radio` access point usually has **no route to the internet**. Cloud features (Supabase, map tiles, external CSV URLs) use **HTTPS** and need a path to the internet—often **cellular** while the phone stays joined to `KV4P-Radio`.

## Field guidance

1. Join **KV4P-Radio** for voice/data to the board.
2. Leave **cellular data enabled** for QRP Mobile if you want maps, repeater directory sync, and Settings imports while operating on the radio Wi‑Fi.
3. On iPhone, if iOS asks about a network **without internet**, choose to **keep using** that Wi‑Fi for local access to the radio (not “use cellular only” for everything in a way that drops the LAN route—behavior varies by iOS version; test on your device).
4. **USB/BLE** to the radio avoids the “no internet on this Wi‑Fi” constraint for the **radio link** only; cloud features still need internet when you use them.

## QA matrix (fill in on real hardware)

Run each row on **iPhone** (or primary target device). Mark **Pass / Fail / N/A**.

| # | Condition | Voice tab + Wi‑Fi radio audio | Contacts → My List (Supabase) | Contacts → Repeaters (Supabase) | Map basemap (OSM tiles) | Map location dot (GPS) | Settings → cloud import / detect country |
|---|-----------|------------------------------|-------------------------------|-----------------------------------|-------------------------|-------------------------|------------------------------------------|
| 1 | Cellular **ON**, Wi‑Fi = **KV4P-Radio** only | | | | | | |
| 2 | Cellular **OFF**, Wi‑Fi = **KV4P-Radio** only | | | | | | |
| 3 | Cellular **ON**, Wi‑Fi = **home internet** + radio on USB/BLE (if available) | | | | | | |

**Expected (typical iOS, not guaranteed):** Row 1 often passes all columns: WebSocket stays on Wi‑Fi; HTTPS uses cellular. Row 2: voice/radio and GPS may still work; cloud and tiles usually **fail** unless offline cache is warm. Row 3: internet via Wi‑Fi; all cloud features should work.

## App mitigations (implemented in codebase)

- **Banners** on Map, Contacts, and Settings when the browser reports offline or when cloud/tile requests fail (radio may still work).
- **Bundled Leaflet marker icons** so the map does not depend on `unpkg` when tiles are the only missing piece.
- **IndexedDB cache** for contacts and last repeater snapshot: local-first display when the network path to Supabase is down.
- **Map fallback**: coordinate readout when basemap tiles cannot load (no MBTiles bundle required).

## Notes column

Use this space during QA:

```
Date:
Device / iOS:
Row 1 notes:
Row 2 notes:
Row 3 notes:
```
