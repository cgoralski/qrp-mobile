# iOS local build and deploy (Mac + Xcode + iPhone)

This guide walks through preparing **QRP Mobile** on a Mac (including Apple Silicon such as M1) and installing it on a physical **iPhone** for testing. Capacitor is already declared in this project’s `package.json`; you use **`npx cap`** from the repo root—no separate global “Capacitor install” is required.

**Related project facts**

- `capacitor.config.ts` sets `webDir` to **`dist-native`** — the site PWA build uses **`dist/`**; Capacitor must never sync that folder. Run **`npm run build:capacitor`** before `cap sync`.
- App id: `com.vk4cgo.qrpmobile` (see `capacitor.config.ts`).
- Server-side deploy notes (nginx, `.env`, Supabase) live in [`docs/DEPLOY.md`](../docs/DEPLOY.md).
- The **HTTPS PWA** from your public URL **cannot** open `ws://` to the ESP32; use this native build for Wi‑Fi. See [`pwa-wifi-and-https.md`](./pwa-wifi-and-https.md).

---

## 1. One-time Mac setup

### Xcode

Install from the Mac App Store. Open it once and accept the license; install extra components if prompted.

### Command Line Tools

If `git` or `xcodebuild` complain:

```bash
xcode-select --install
```

### Node.js 22+

Required for this project (Node 22+; see `docs/DEPLOY.md`). Install from [nodejs.org](https://nodejs.org/) LTS, or e.g.:

```bash
brew install node@22
```

Verify:

```bash
node -v   # v22.x or newer (Capacitor 8 CLI requires >=22)
npm -v
```

### CocoaPods

The iOS app uses a `Podfile` under `ios/App/`. Install CocoaPods:

```bash
sudo gem install cocoapods
# or: brew install cocoapods
pod --version
```

### Apple ID

A **free** Apple ID is enough to install on **your own** iPhone for development. A paid Apple Developer Program membership is only needed for TestFlight, App Store, or broader distribution.

---

## 2. Get the project on the Mac

Clone or copy the full repository (including `ios/`, `package.json`, `capacitor.config.ts`).

---

## 3. Install dependencies and environment

From the project root:

```bash
cd /path/to/qrpmobile.vk4cgo.com
npm ci
# or: npm install
```

Ensure a **`.env`** file exists with the required `VITE_*` variables. See [`docs/DEPLOY.md`](../docs/DEPLOY.md) §1 for the expected keys (Supabase URL, anon key, etc.).

---

## 4. Build the web app, then sync into iOS

```bash
npm run build:capacitor
npx cap sync ios
```

- **`npm run build:capacitor`** (no PWA/service worker — avoids blank WKWebView) writes the native bundle to **`dist-native/`** (single JS file; no `leaflet-*.js` chunks).
- **`npx cap sync ios`** copies **`dist-native/`** into the native project. Do not run **`npm run build`** (web/PWA) and then sync — that only updates **`dist/`**, which Capacitor no longer uses.

**Whenever you change web code or add/upgrade Capacitor plugins**, repeat **build → `cap sync ios`** before rebuilding in Xcode.

---

## 5. Install iOS CocoaPods

```bash
cd ios/App
pod install
cd ../..
```

Always open **`ios/App/App.xcworkspace`** in Xcode (not the `.xcodeproj` alone) after using CocoaPods.

---

## 6. Open in Xcode and configure signing

```bash
open ios/App/App.xcworkspace
```

In Xcode:

1. Select the **App** project in the navigator, then the **App** target.
2. Open **Signing & Capabilities**.
3. Enable **Automatically manage signing**.
4. Choose your **Team** (your Apple ID).
5. Resolve any signing or bundle identifier issues Xcode reports.

---

## 7. Prepare the iPhone

1. Connect the iPhone with USB; unlock it; tap **Trust** if the Mac asks.
2. **iOS 16+**: enable **Developer Mode**: **Settings → Privacy & Security → Developer Mode** (reboot if required).
3. The first time you run a build signed with a personal team, you may need to trust the developer certificate: **Settings → General → VPN & Device Management**.

---

## 8. Run on the device

1. In Xcode’s toolbar, choose the run destination: **your physical iPhone** (use a real device if you need to test Wi‑Fi / KV4P radio connectivity; the simulator behaves differently).
2. **Product → Run** (▶).

If the build fails, read the first error in Xcode’s issue navigator (signing vs pods vs deployment target).

---

## 9. Capacitor CLI version alignment

This repo may have mixed `@capacitor` package versions in `package.json`. If `npx cap` behaves oddly, align **CLI, core, ios, and android** to the same major version, then rebuild and sync:

```bash
npm install @capacitor/cli@^8 @capacitor/core@^8 @capacitor/ios@^8 @capacitor/android@^8
npm run build:capacitor
npx cap sync ios
cd ios/App && pod install && cd ../..
```

Adjust the major version number to match what the project uses when you run this.

---

## 10. iOS Local Network permission (KV4P over Wi‑Fi)

To connect to the ESP32 at **`ws://192.168.4.1:8765`** (or similar), the app needs **local network** access on iOS 14+.

- The project includes **`NSLocalNetworkUsageDescription`** in `ios/App/App/Info.plist`.
- On first use, iOS may prompt for **Local Network** — choose **Allow**.
- If you denied it: **Settings → Privacy & Security → Local Network** → enable **QRP Mobile**.

---

## Quick reference (typical iteration after web changes)

```bash
npm run build:capacitor
npx cap sync ios
cd ios/App && pod install && cd ../..
open ios/App/App.xcworkspace
```

Then **Run** in Xcode to the iPhone.

---

## Optional: check Capacitor CLI

```bash
npx cap --version
```

Always run `npx cap …` from the **project root** (where `capacitor.config.ts` lives).
