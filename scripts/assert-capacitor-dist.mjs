/**
 * Ensures dist-native/ is the Capacitor bundle (npm run build:capacitor).
 * The site PWA lives in dist/; cap sync must never use that folder for native.
 *
 * Native builds use code splitting (lazy routes + tabs); `index.html` should
 * reference only the entry module — additional chunks load via dynamic `import()`.
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

const assetsDir = path.join(NATIVE_ROOT, "assets");
if (!fs.existsSync(assetsDir)) {
  problems.push("dist-native/assets/ missing.");
} else {
  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
  const entry = jsFiles.find((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
  if (!entry) {
    problems.push(
      `No entry bundle index-[hash].js in dist-native/assets/ (found: ${jsFiles.join(", ") || "(none)"}).`,
    );
  }
  if (jsFiles.length === 0) {
    problems.push("dist-native/assets/ has no .js files.");
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
console.log(`  JS chunks in dist-native/assets/: ${jsListed.length} file(s)`);
console.log("     " + jsListed.sort().join(", "));
console.log("");
console.log("  For iOS/Android use ONLY dist-native/ (cap sync reads webDir).");
console.log("  Ignore dist/ for native: npm run build puts the PWA there.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");
