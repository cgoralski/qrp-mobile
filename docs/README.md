# QRP Mobile — documentation index

Web and native app for **KV4P** radio control, contacts, maps, and Supabase-backed repeater data.

## Quick start (local dev)

Requires **Node.js ≥ 22** (see repo `.nvmrc`).

```sh
cd /path/to/qrp-mobile
npm ci
npm run dev
```

The dev server listens on port **8080** by default (see `vite.config.ts`).

## Main docs

| Topic | Document |
|--------|-----------|
| Server deploy, nginx, Supabase | [DEPLOY.md](./DEPLOY.md) |
| KV4P-Radio Wi‑Fi vs internet (iPhone field SOP) | [WIFI_INTERNET_QA.md](./WIFI_INTERNET_QA.md) |
| Wi‑Fi / BLE connectivity strategy | [WIFI_CONNECTIVITY_STRATEGY.md](./WIFI_CONNECTIVITY_STRATEGY.md) |
| Firmware | [firmware/](./firmware/) |
| PCB / hardware | [pcb/](./pcb/) |

## Builds

- **PWA / web:** `npm run build` → `dist/`
- **iOS / Android (Capacitor):** `npm run build:capacitor` then `npx cap sync` (see `package.json` scripts and [DEPLOY.md](./DEPLOY.md))

## Stack (high level)

Vite, TypeScript, React, React Router, Tailwind CSS, shadcn-ui patterns, Radix, Supabase client, Leaflet / react-leaflet, Capacitor for native shells.
