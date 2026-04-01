import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Capacitor WKWebView fixes:
 * - Strip `crossorigin` (CORS-mode modules fail on capacitor:// scheme)
 * - Add onerror on module script tag so failures are visible
 * - Inject full-screen diagnostic overlay (classic script, runs before module)
 */
function capacitorNativeHtmlPlugin(): Plugin {
  return {
    name: "capacitor-native-html",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        let out = html;

        // 1. Remove external font/preconnect links (stall on native without internet)
        out = out.replace(/<link[^>]*href="https:\/\/fonts\.(googleapis|gstatic)\.com[^>]*\/?>/gi, "");
        out = out.replace(/<link[^>]*preconnect[^>]*\/?>/gi, "");

        // 2. Strip ALL crossorigin attributes (module CORS fails on capacitor://)
        out = out.replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, "");

        // 2. Add onerror to the module script tag so we catch load failures visually
        out = out.replace(
          /<script\s+type="module"\s+src="([^"]+)">/gi,
          `<script type="module" src="$1" onerror="document.getElementById('cap-diag').textContent='SCRIPT LOAD FAILED: $1'">`,
        );

        // 3. Inject a classic (non-module) diagnostic script at the very top of <body>
        //    This runs synchronously before any module script, guaranteed.
        const diagScript = `
<style>
body{background:#0f172a!important}
#cap-diag{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#94a3b8;background:#0f172a;padding:20px;text-align:center}
#cap-diag.err{color:#fca5a5}
.cap-spin{width:44px;height:44px;border-radius:50%;border:3px solid rgba(56,189,248,0.2);border-top-color:#38bdf8;animation:cap-spin-rot 0.85s linear infinite;box-sizing:border-box}
@keyframes cap-spin-rot{to{transform:rotate(360deg)}}
</style>
<div id="cap-diag">
  <div style="font-size:20px;font-weight:600;color:#38bdf8;letter-spacing:0.02em">QRP Mobile</div>
  <div class="cap-spin" aria-hidden="true"></div>
  <div id="cap-diag-msg" style="font-size:13px;opacity:0.85">Loading app…</div>
</div>
<script>
(function(){
  var d=document.getElementById("cap-diag"),m=document.getElementById("cap-diag-msg");
  function show(t,err){m.textContent=t;if(err)d.className="err";}
  window.__capDiag=show;
  window.addEventListener("error",function(ev){
    show("JS ERROR: "+(ev.message||"unknown")+" @ "+(ev.filename||"?").split("/").pop()+":"+ev.lineno,true);
  });
  window.addEventListener("unhandledrejection",function(ev){
    var r=ev.reason;show("UNHANDLED: "+(r&&r.message?r.message:String(r)),true);
  });
  setTimeout(function(){
    if(d.parentNode&&!d.className){show("Module script did not execute within 6s. Possible WKWebView module load failure.",true);}
  },6000);
})();
</script>`;

        // Match `<body>` or `<body …>` (index.html uses inline styles on body)
        out = out.replace(/<body([^>]*)>/, `<body$1>${diagScript}`);
        return out;
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isCapacitor = mode === "capacitor";

  return {
    base: "./",
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      isCapacitor && capacitorNativeHtmlPlugin(),
      mode === "development" && componentTagger(),
      !isCapacitor &&
        VitePWA({
          registerType: "autoUpdate",
          includeAssets: ["placeholder.svg"],
          manifest: {
            name: "QRP Mobile",
            short_name: "QRPMobile",
            description: "KV4P radio control",
            theme_color: "#0f172a",
            background_color: "#020617",
            display: "standalone",
            start_url: "/",
            icons: [
              {
                src: "/placeholder.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any maskable",
              },
            ],
          },
          workbox: {
            globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
            runtimeCaching: [],
            navigateFallback: "/index.html",
            navigateFallbackAllowlist: [/^\//],
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // Prevents react-leaflet (or other libs) from resolving a second React copy → createContext undefined in a split chunk.
      dedupe: ["react", "react-dom"],
    },
    build: {
      // PWA/site → dist/ ; Capacitor → dist-native/ so `npx cap sync` never copies the wrong tree.
      outDir: isCapacitor ? "dist-native" : "dist",
      emptyOutDir: true,
      modulePreload: isCapacitor ? false : undefined,
      chunkSizeWarningLimit: isCapacitor ? 4000 : 950,
      rollupOptions: {
        output: isCapacitor
          ? {
              // One ES module for the whole app: fixes WKWebView + satellite chunks where react-leaflet
              // ran before shared React (TypeError: undefined is not an object (evaluating 'Z.createContext')).
              inlineDynamicImports: true,
            }
          : {
              manualChunks(id: string) {
                if (!id.includes("node_modules")) return;
                if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
                if (id.includes("@radix-ui")) return "radix-ui";
                if (id.includes("leaflet") || id.includes("react-leaflet")) return "leaflet";
                if (id.includes("recharts")) return "recharts";
                if (id.includes("@supabase")) return "supabase";
                if (id.includes("@tanstack/react-query")) return "tanstack-query";
                return "vendor";
              },
            },
      },
    },
  };
});
