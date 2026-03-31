/**
 * Capacitor iOS `generateIOSPackageJSON` only scans node_modules plugins for @objc
 * names — Swift plugins that live in the App target (e.g. RxPcmAudioPlugin) are
 * never added. Without them, JS shows "plugin is not implemented on ios".
 *
 * This runs after `cap copy` / `cap sync` (via capacitor:copy:after, capacitor:sync:after,
 * and a final run at the end of `npm run ios:sync`). You can also run:
 *   npm run patch:ios-cap-plugins
 *
 * @see https://github.com/ionic-team/capacitor/blob/main/cli/src/util/iosplugin.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, "../ios/App/App/capacitor.config.json");
/** Swift module is the Xcode target name (default "App"). */
const EXTRA_CLASSES = ["App.RadioLinkKeepAlivePlugin", "App.RxPcmAudioPlugin"];

if (!fs.existsSync(jsonPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(jsonPath, "utf8");
const j = JSON.parse(raw);
const list = new Set(Array.isArray(j.packageClassList) ? j.packageClassList : []);
for (const c of EXTRA_CLASSES) list.add(c);
j.packageClassList = [...list].sort();
fs.writeFileSync(jsonPath, JSON.stringify(j, null, "\t") + "\n");
console.log("[patch-ios-package-class-list] packageClassList:", j.packageClassList);
