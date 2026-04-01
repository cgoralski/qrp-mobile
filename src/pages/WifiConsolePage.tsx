import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardCopy, Trash2 } from "lucide-react";
import ConnectionStatus from "@/components/ConnectionStatus";
import WifiProvisioningModal from "@/components/WifiProvisioningModal";
import { Button } from "@/components/ui/button";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useKv4p } from "@/contexts/Kv4pContext";
import { getSavedWifiHost, getSavedWifiPort } from "@/lib/wifi-storage";
import {
  clearWifiDiag,
  formatWifiDiagExport,
  getWifiDiagSnapshot,
  logWifiDiag,
  subscribeWifiDiag,
  WIFI_DIAG_MAX_ENTRIES,
  type WifiDiagEntry,
} from "@/lib/wifi-diagnostics";
import { getSessionStatsLine } from "@/lib/session-log";
import { BAND_CONFIGS, type BandId } from "@/lib/hardware";
import { toast } from "sonner";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const t = d.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${t}.${ms}`;
}

export default function WifiConsolePage() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLPreElement>(null);
  /** When false, user scrolled up — do not jump to bottom on each new line. */
  const stickToBottomRef = useRef(true);
  const [lines, setLines] = useState<WifiDiagEntry[]>(() => getWifiDiagSnapshot());
  const [wifiProvisioningOpen, setWifiProvisioningOpen] = useState(false);

  const {
    connected,
    connectionType,
    deviceName,
    connecting,
    error,
    connect,
    connectViaUsb,
    connectViaWifi,
    isBluetoothSupported,
    isSerialSupported,
    isWifiSupported,
    clearError,
  } = useDeviceConnection();

  const { version: deviceVersion } = useKv4p();

  const boardBand: BandId = useMemo(() => {
    if (!deviceVersion) return null;
    if (deviceVersion.rfModuleType === 0) return "VHF";
    if (deviceVersion.rfModuleType === 1) return "UHF";
    return null;
  }, [deviceVersion]);

  const savedWifiHost = getSavedWifiHost();
  const savedWifiPort = getSavedWifiPort();

  const refreshLines = useCallback(() => {
    setLines(getWifiDiagSnapshot());
  }, []);

  useEffect(() => refreshLines(), [refreshLines]);

  useEffect(() => {
    return subscribeWifiDiag(refreshLines);
  }, [refreshLines]);

  useEffect(() => {
    void (async () => {
      logWifiDiag("── Wi‑Fi console page opened ──");
      let cap = "n/a";
      try {
        const { Capacitor } = await import("@capacitor/core");
        cap = `native=${Capacitor.isNativePlatform()} platform=${Capacitor.getPlatform()}`;
      } catch {
        cap = "Capacitor not loaded";
      }
      logWifiDiag(`[Env] ${cap}`);
      logWifiDiag(`[Env] location.href=${typeof location !== "undefined" ? location.href : "?"}`);
      logWifiDiag(`[Env] protocol=${typeof location !== "undefined" ? location.protocol : "?"}`);
      logWifiDiag(`[Env] navigator.onLine=${typeof navigator !== "undefined" ? navigator.onLine : "?"}`);
      logWifiDiag(
        `[Env] saved board host=${savedWifiHost ?? "(none)"} port=${savedWifiPort} default ws=ws://${savedWifiHost ?? "192.168.4.1"}:${savedWifiPort}`
      );
      logWifiDiag(
        `[Env] WebSocket=${typeof WebSocket !== "undefined" ? "yes" : "no"} userAgent=${typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "?"}…`
      );
      refreshLines();
    })();
  }, [savedWifiHost, savedWifiPort, refreshLines]);

  const handleLogScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 96;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const jumpToLatest = useCallback(() => {
    stickToBottomRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const onVis = () => {
      logWifiDiag(`[Life] visibilityState=${document.visibilityState}`);
    };
    const onPageShow = (e: Event) => {
      const pe = e as PageTransitionEvent;
      logWifiDiag(`[Life] pageshow persisted=${pe.persisted === true}`);
    };
    const onPageHide = (e: Event) => {
      const pe = e as PageTransitionEvent;
      logWifiDiag(`[Life] pagehide persisted=${pe.persisted === true}`);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const prevUiSig = useRef("");
  useEffect(() => {
    const sig = `${connected}|${connectionType}|${connecting}|${error ?? ""}`;
    if (sig === prevUiSig.current) return;
    prevUiSig.current = sig;
    logWifiDiag(
      `[UI] connected=${connected} type=${connectionType ?? "null"} connecting=${connecting} error=${error ? JSON.stringify(error) : "null"}`
    );
    refreshLines();
  }, [connected, connectionType, connecting, error, refreshLines]);

  const handleCopy = async () => {
    const text =
      formatWifiDiagExport(lines) +
      "\n\n--- Session counters (at copy time) ---\n" +
      getSessionStatsLine();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Log copied to clipboard");
    } catch {
      toast.error("Could not copy (permission?)");
    }
  };

  const handleClear = () => {
    clearWifiDiag();
    logWifiDiag("── Log cleared by user ──");
    refreshLines();
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-mesh overflow-hidden animate-in slide-in-from-right duration-300">
      <header
        className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] backdrop-blur-sm"
        data-no-swipe
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => navigate("/")}
          aria-label="Back to radio"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-mono-display text-sm font-bold tracking-wider text-foreground truncate">
            Wi‑Fi console
          </h1>
          <p className="text-[10px] text-muted-foreground truncate">
            WebSocket · device link · KV4P · <span className="text-foreground/70">[Session]</span> startup trace
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1" data-no-swipe>
          <ConnectionStatus
            connected={connected}
            connectionType={connectionType}
            boardBand={boardBand}
            deviceName={deviceName}
            connecting={connecting}
            error={error}
            onConnectBle={connect}
            onConnectUsb={connectViaUsb}
            onConnectWifi={connectViaWifi}
            savedWifiHost={savedWifiHost}
            savedWifiPort={savedWifiPort}
            defaultWifiHost="192.168.4.1"
            defaultWifiPort={8765}
            onOpenSetUpWifi={() => setWifiProvisioningOpen(true)}
            isBluetoothSupported={isBluetoothSupported}
            isSerialSupported={isSerialSupported}
            isWifiSupported={isWifiSupported}
            onOpenWifiDiagnostics={() => navigate("/wifi-console")}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/40" data-no-swipe>
        <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={handleCopy}>
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy all
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleClear}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear log
        </Button>
        {error && (
          <Button type="button" variant="ghost" size="sm" onClick={clearError}>
            Dismiss error
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={jumpToLatest}>
          Jump to latest
        </Button>
      </div>

      <div className="px-3 py-2 text-[10px] font-mono text-muted-foreground space-y-0.5 border-b border-border/30 shrink-0">
        <p>
          <span className="text-foreground/80">Link:</span>{" "}
          {connecting
            ? "connecting…"
            : connected && connectionType === "wifi"
              ? "Wi‑Fi connected"
              : connected
                ? `${connectionType ?? "?"} (not Wi‑Fi)`
                : "idle"}
        </p>
        {deviceVersion && (
          <p>
            <span className="text-foreground/80">Board:</span> ver={deviceVersion.ver} rf=
            {deviceVersion.rfModuleType}{" "}
            {boardBand && BAND_CONFIGS[boardBand] ? `(${BAND_CONFIGS[boardBand].badge})` : ""}
          </p>
        )}
        <p className="text-cyan-600/90 dark:text-cyan-400/90 leading-snug break-words">
          {getSessionStatsLine()}
        </p>
        <p className="opacity-90">
          Filter mentally for <code className="text-foreground/80">[Session</code> lines — elapsed ms is from JS
          bundle load; counters summarize Wi‑Fi / RX / KV4P churn until you clear the log.
        </p>
        <p className="opacity-85 text-[9px] leading-snug">
          <span className="text-foreground/70">Note:</span>{" "}
          <code className="text-foreground/80">wifi_auto_off</code> on foreground until you have connected to
          the board once this session — then auto‑re‑connect after drops is allowed. Slow{" "}
          <code className="text-foreground/80">wifi_ws.connect</code> (multi‑second) is usually iOS/AP TCP to
          192.168.4.1, not JS. High‑rate <code className="text-foreground/80">[WS] rx</code> /{" "}
          <code className="text-foreground/80">[KV4P] pkt</code> lines are only recorded while this console is
          open (saves CPU for RX audio when you are on the radio screen).
        </p>
      </div>

      <pre
        ref={scrollRef}
        onScroll={handleLogScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2 pb-2 font-mono text-[10px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words"
      >
        {lines.length === 0 ? (
          <span className="text-muted-foreground">No log lines yet. Tap Connect → Connect to board.</span>
        ) : (
          lines.map((e, i) => (
            <span key={`${e.ts}-${i}`} className="block">
              <span className="text-muted-foreground select-none">{formatTime(e.ts)} </span>
              {e.message}
            </span>
          ))
        )}
      </pre>

      <div className="shrink-0 border-t border-border/40 px-3 py-1.5 text-[9px] font-mono text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <span>
          Buffer: <span className="text-foreground/80">{lines.length}</span> / {WIFI_DIAG_MAX_ENTRIES} lines
        </span>
        <span className="opacity-80">Scroll up for history; new lines append at bottom.</span>
      </div>

      <WifiProvisioningModal
        open={wifiProvisioningOpen}
        onOpenChange={setWifiProvisioningOpen}
        onSuccess={(ip) => connectViaWifi(ip, savedWifiPort)}
      />
    </div>
  );
}
