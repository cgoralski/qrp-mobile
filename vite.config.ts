import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Capacitor WKWebView fixes:
 * - Strip `crossorigin` (CORS-mode modules fail on capacitor:// scheme)
 * - Module onerror + bootstrap: `__capDiag` / console only (no WebView splash overlay)
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

        out = out.replace(
          /<script\s+type="module"\s+src="([^"]+)">/gi,
          `<script type="module" src="$1" onerror="console.error('[QRP Mobile] Module load failed','$1')">`,
        );

        // Classic bootstrap before the module: __capDiag for main.tsx + console logging only (no splash UI).
        const bootstrapScript = `
<script>
(function(){
  function logErr(a,b){console.error("[QRP Mobile]",a,b!==undefined?b:"");}
  window.__capDiag=function(t,err){if(err)logErr(t);};
  window.addEventListener("error",function(ev){
    logErr("JS error:",(ev.message||"unknown")+" @ "+(ev.filename||"?").split("/").pop()+":"+ev.lineno);
  });
  window.addEventListener("unhandledrejection",function(ev){
    var r=ev.reason;logErr("Unhandled:",r&&r.message?r.message:String(r));
  });
  setTimeout(function(){
    var el=document.getElementById("root");
    if(el&&!el.hasChildNodes())logErr("Startup: #root still empty after 6s — check console / network.");
  },6000);
})();
</script>`;

        out = out.replace(/<body([^>]*)>/, `<body$1>${bootstrapScript}`);
        return out;
      },
    },
  };
}

/**
 * Shared vendor splits: single `react-vendor` for React.
 * IMPORTANT: `react-leaflet` must live in `react-vendor`, not in the `leaflet` chunk.
 * Putting both in one "leaflet" chunk created a cycle: react-vendor → leaflet → react-vendor,
 * so `createContext` was undefined on iOS (blank screen after splash).
 */
function rollupManualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  // scheduler is a react-dom dependency — must not land in `vendor` or you get
  // react-vendor → vendor → react-vendor and `forwardRef` / `createContext` are undefined (iOS blank screen).
  if (id.includes("/scheduler/") || id.includes("\\scheduler\\")) return "react-vendor";
  if (id.includes("react-dom") || id.includes("/react/") || id.includes("\\react\\")) return "react-vendor";
  if (id.includes("react-leaflet")) return "react-vendor";
  if (id.includes("/leaflet/") || id.includes("\\leaflet\\")) return "leaflet";
  if (id.includes("@radix-ui")) return "radix-ui";
  if (id.includes("recharts")) return "recharts";
  if (id.includes("@supabase")) return "supabase";
  if (id.includes("@tanstack/react-query")) return "tanstack-query";
  if (id.includes("opus-decoder")) return "opus-decoder";
  return "vendor";
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
      chunkSizeWarningLimit: isCapacitor ? 2000 : 950,
      rollupOptions: {
        output: {
          // Capacitor/WKWebView: custom manualChunks created react-vendor ↔ vendor cycles
          // (forwardRef / createContext undefined → blank #root). Use Rollup defaults for native.
          ...(isCapacitor ? {} : { manualChunks: rollupManualChunks }),
        },
      },
    },
  };
});
