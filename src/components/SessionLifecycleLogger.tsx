import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { bumpSessionStat, logSession } from "@/lib/session-log";

/**
 * Mount once under the router: logs app/WebView readiness and every Capacitor appStateChange
 * (helps explain multi-tap / delayed settle on iOS).
 */
export function SessionLifecycleLogger() {
  const appListenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  useEffect(() => {
    logSession("React tree mounted (SessionLifecycleLogger)", {
      readyState: typeof document !== "undefined" ? document.readyState : "?",
    });

    const onReady = () => {
      logSession("document readystatecomplete", {
        visibility: typeof document !== "undefined" ? document.visibilityState : "?",
      });
    };
    if (typeof document !== "undefined" && document.readyState === "complete") {
      onReady();
    } else if (typeof document !== "undefined") {
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "complete") onReady();
      });
    }

    void (async () => {
      try {
        const plat = Capacitor.getPlatform();
        const native = Capacitor.isNativePlatform();
        logSession("Capacitor env", { platform: plat, native });
      } catch {
        logSession("Capacitor env", { error: "not_available" });
      }
    })();

    const onOnline = () => logSession("navigator online");
    const onOffline = () => logSession("navigator offline");
    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }

    const onVis = () =>
      logSession("document visibility", { state: typeof document !== "undefined" ? document.visibilityState : "?" });
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        logSession("Capacitor appStateChange", { isActive });
        if (isActive) bumpSessionStat("appStateActive");
        else bumpSessionStat("appStateInactive");
      }).then((h) => {
        appListenerRef.current = h;
      });
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      void appListenerRef.current?.remove();
      appListenerRef.current = null;
    };
  }, []);

  return null;
}
