/**
 * Ensures dist-native/ is the Capacitor bundle (npm run build:capacitor).
 * The site PWA lives in dist/; cap sync must never use that folder (leaflet-*.js chunks crash WKWebView).
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const NATIVE_ROOT = path.resolve(ROOT, "dist-native");
const htmlPath = path.join(NATIVE_ROOT, "index.html");

if (!fs.existsSync(htmlPath)) {
  console.error(
    "assert-capacitor-dist: dist-native/index.html missing — run: npm run build:capacitor\n" +
      "(Capacitor output is dist-native/, not dist/.)",
  );
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");
const problems = [];

if (/registerSW|vite-plugin-pwa|manifest\.webmanifest/i.test(html)) {
  problems.push(
    "PWA artifacts in dist-native/index.html. Use only: npm run build:capacitor (not npm run build) before cap sync.",
  );
}

if (/src=["']\/assets\//.test(html) || /href=["']\/assets\//.test(html)) {
  problems.push('Absolute /assets/ paths in index.html; vite base should be "./" for native.');
}

if (/crossorigin/i.test(html)) {
  problems.push(
    "crossorigin still present in dist-native/index.html; capacitor-native-html plugin should strip it for WKWebView.",
  );
}

// Satellite chunks (web build) cause: TypeError: undefined is not an object (evaluating 'Z.createContext') in leaflet-*.js
const forbiddenChunk =
  /leaflet-[A-Za-z0-9_-]+\.js|react-vendor-[A-Za-z0-9_-]+\.js|vendor-[A-Za-z0-9_-]+\.js|tanstack-query-[A-Za-z0-9_-]+\.js|radix-ui-[A-Za-z0-9_-]+\.js|supabase-[A-Za-z0-9_-]+\.js/i;
if (forbiddenChunk.test(html)) {
  problems.push(
    "dist-native/index.html references split vendor chunks (e.g. leaflet-*.js). Fix vite capacitor build (inlineDynamicImports).",
  );
}

const assetsDir = path.join(NATIVE_ROOT, "assets");
if (!fs.existsSync(assetsDir)) {
  problems.push("dist-native/assets/ missing.");
} else {
  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
  if (jsFiles.length !== 1) {
    problems.push(
      `Capacitor native build must emit exactly ONE JS file in dist-native/assets/ (found ${jsFiles.length}: ${jsFiles.join(", ") || "(none)"}). ` +
        "Wrong folder? cap sync copies webDir (dist-native), not dist/. Never run only npm run build before sync.",
    );
  } else {
    const only = jsFiles[0];
    if (!/^index-[A-Za-z0-9_-]+\.js$/.test(only)) {
      problems.push(`Unexpected sole bundle name "${only}" (expected index-[hash].js).`);
    }
    if (/leaflet|vendor|react-vendor|radix|supabase|tanstack/i.test(only)) {
      problems.push(`Sole JS file name looks like a web chunk: ${only}`);
    }
  }
}

if (problems.length) {
  console.error("assert-capacitor-dist failed:\n- " + problems.join("\n- "));
  process.exit(1);
}

const jsListed = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
console.log("");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  Capacitor native bundle OK  →  dist-native/");
console.log("  JS in dist-native/assets/:  " + jsListed.join(", "));
console.log("");
console.log("  For iOS/Android use ONLY dist-native/ (cap sync reads webDir).");
console.log("  Ignore dist/ for native: npm run build puts leaflet-*.js chunks there");
console.log("  for the website PWA — that is expected and must NOT be synced.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");
