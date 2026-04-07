import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import * as ble from "@/lib/ble-device";
import * as serial from "@/lib/serial-device";
import * as ws from "@/lib/websocket-device";
import { getSavedWifiHost, getSavedWifiPort, saveWifiHostFromUrl } from "@/lib/wifi-storage";
import { logWifiDiag } from "@/lib/wifi-diagnostics";
import { bumpSessionStat, logSession } from "@/lib/session-log";
import { RadioLinkKeepAlive } from "@/plugins/radio-link-keepalive";
import type { ConnectionType } from "@/contexts/device-connection-types";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";

export interface UseDeviceWifiEffectsParams {
  connectionType: ConnectionType;
  setConnectionType: Dispatch<SetStateAction<ConnectionType>>;
  setDeviceName: Dispatch<SetStateAction<string | null>>;
  setConnecting: (v: boolean) => void;
  setError: (v: string | null) => void;
  setRxPlaybackEpoch: Dispatch<SetStateAction<number>>;
  onDataRef: MutableRefObject<((data: Uint8Array) => void) | null>;
  rxPlaybackHandleRef: MutableRefObject<RxPlaybackHandle | null>;
  logRxDestroyIfAny: (reason: string) => void;
  connectingRef: MutableRefObject<boolean>;
  connectionTypeRef: MutableRefObject<ConnectionType>;
  wifiAutoReconnectEnabledRef: MutableRefObject<boolean>;
  wifiDropReconnectTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  connectViaWifiRef: MutableRefObject<(host: string, port?: number) => Promise<void>>;
  connectViaWifi: (hostOrUrl: string, port?: number) => Promise<void>;
}

/**
 * Wi‑Fi transport: keep-alive, foreground reconnect, transient drop reconnect, WebSocket callbacks.
 */
export function useDeviceWifiEffects({
  connectionType,
  setConnectionType,
  setDeviceName,
  setConnecting,
  setError,
  setRxPlaybackEpoch,
  onDataRef,
  rxPlaybackHandleRef,
  logRxDestroyIfAny,
  connectingRef,
  connectionTypeRef,
  wifiAutoReconnectEnabledRef,
  wifiDropReconnectTimerRef,
  connectViaWifiRef,
  connectViaWifi,
}: UseDeviceWifiEffectsParams): void {
  const lastWifiAutoReconnectAtRef = useRef(0);
  const scheduleWifiDropReconnectRef = useRef<(source: string) => void>(() => {});

  const scheduleWifiDropReconnect = useCallback((source: string) => {
    if (!Capacitor.isNativePlatform()) {
      logSession("wifi_auto_reconnect skipped", { reason: "not_native", source });
      return;
    }
    if (!wifiAutoReconnectEnabledRef.current) {
      logSession("wifi_auto_reconnect skipped", { reason: "flag_off", source });
      return;
    }
    const host = getSavedWifiHost();
    if (!host) {
      logSession("wifi_auto_reconnect skipped", { reason: "no_saved_host", source });
      return;
    }
    if (wifiDropReconnectTimerRef.current) clearTimeout(wifiDropReconnectTimerRef.current);
    bumpSessionStat("wifiAutoReconnectScheduled");
    logSession("wifi_auto_reconnect timer_armed", { source, delayMs: 400, host });
    wifiDropReconnectTimerRef.current = setTimeout(() => {
      wifiDropReconnectTimerRef.current = null;
      if (!wifiAutoReconnectEnabledRef.current) {
        logSession("wifi_auto_reconnect timer_fired_skipped", { reason: "flag_off" });
        return;
      }
      const now = Date.now();
      if (now - lastWifiAutoReconnectAtRef.current < 1200) {
        bumpSessionStat("wifiAutoReconnectSkippedCooldown");
        logWifiDiag("[DeviceConn] WiFi auto-reconnect skipped (cooldown)");
        logSession("wifi_auto_reconnect skipped_cooldown", {
          msSinceLast: now - lastWifiAutoReconnectAtRef.current,
        });
        return;
      }
      if (connectingRef.current) {
        logSession("wifi_auto_reconnect timer_fired_skipped", { reason: "already_connecting" });
        return;
      }
      if (connectionTypeRef.current !== null) {
        logSession("wifi_auto_reconnect timer_fired_skipped", { reason: "already_connected" });
        return;
      }
      bumpSessionStat("wifiAutoReconnectInvoked");
      lastWifiAutoReconnectAtRef.current = now;
      logWifiDiag(`[DeviceConn] WiFi transient drop (${source}) → auto-reconnect ${host}`);
      logSession("wifi_auto_reconnect invoking_connectViaWifi", { source, host });
      setError(null);
      void connectViaWifiRef.current(host, getSavedWifiPort());
    }, 400);
  }, [
    connectViaWifiRef,
    connectingRef,
    connectionTypeRef,
    setError,
    wifiAutoReconnectEnabledRef,
    wifiDropReconnectTimerRef,
  ]);

  useEffect(() => {
    scheduleWifiDropReconnectRef.current = scheduleWifiDropReconnect;
  }, [scheduleWifiDropReconnect]);

  useEffect(() => {
    connectViaWifiRef.current = connectViaWifi;
  }, [connectViaWifi, connectViaWifiRef]);

  // Native: keep process + Wi‑Fi active when screen is off (WLAN path). Android: FGS + locks; iOS: audio background.
  useEffect(() => {
    if (connectionType !== "wifi") return;
    void RadioLinkKeepAlive.enable().catch((e) => {
      console.warn("[RadioLinkKeepAlive] enable failed:", e);
      logWifiDiag("[RadioLinkKeepAlive] enable failed: " + (e instanceof Error ? e.message : String(e)));
    });
    return () => {
      void RadioLinkKeepAlive.disable().catch(() => {});
    };
  }, [connectionType]);

  // Native: after sleep/unlock, TCP may RST; reconnect once if we had a good Wi‑Fi session.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      if (timeoutId) clearTimeout(timeoutId);
      logSession("app_foreground_reconnect_timer_armed", { delayMs: 750 });
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        bumpSessionStat("foregroundReconnectTimerFired");
        if (!wifiAutoReconnectEnabledRef.current) {
          logSession("app_foreground_reconnect skipped", {
            reason: "wifi_auto_off",
            hint: "normal_until_first_successful_WiFi_connect",
          });
          return;
        }
        if (connectingRef.current || connectionTypeRef.current !== null) {
          logSession("app_foreground_reconnect skipped", {
            reason: "already_connecting_or_connected",
            connecting: connectingRef.current,
            hasLink: connectionTypeRef.current !== null,
          });
          return;
        }
        const host = getSavedWifiHost();
        if (!host) {
          logSession("app_foreground_reconnect skipped", { reason: "no_saved_host" });
          return;
        }
        logWifiDiag("[DeviceConn] app foreground: auto-reconnect Wi‑Fi");
        logSession("app_foreground_reconnect invoking_connectViaWifi", { host });
        void connectViaWifiRef.current(host, getSavedWifiPort());
      }, 750);
    }).then((h) => {
      handle = h;
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      void handle?.remove();
    };
  }, [connectViaWifiRef, connectingRef, connectionTypeRef, wifiAutoReconnectEnabledRef]);

  // WebSocket (WiFi) callbacks
  useEffect(() => {
    ws.setCallbacks({
      onConnect: (url) => {
        logSession("wifi_socket_onConnect", { url: url.slice(0, 120) });
        logWifiDiag("[DeviceConn] WiFi onConnect url=" + url);
        saveWifiHostFromUrl(url);
        ble.disconnect().catch(() => {});
        serial.disconnectSerial().catch(() => {});
        setConnectionType("wifi");
        setDeviceName("WiFi");
        setConnecting(false);
        setError(null);
      },
      onDisconnect: () => {
        const wasWifi = connectionTypeRef.current === "wifi";
        bumpSessionStat("wifiDisconnect");
        logSession("wifi_socket_onDisconnect", { wasWifi });
        logWifiDiag("[DeviceConn] WiFi onDisconnect");
        logRxDestroyIfAny("wifi_onDisconnect");
        rxPlaybackHandleRef.current?.destroy();
        rxPlaybackHandleRef.current = null;
        setRxPlaybackEpoch((e) => e + 1);
        setConnectionType((prev) => {
          if (prev === "wifi") setDeviceName(null);
          return prev === "wifi" ? null : prev;
        });
        setConnecting(false);
        if (wasWifi) scheduleWifiDropReconnectRef.current("disconnect");
      },
      onError: (msg) => {
        const wasWifi = connectionTypeRef.current === "wifi";
        bumpSessionStat("wifiTransportError");
        logSession("wifi_socket_onError", {
          wasWifi,
          msg: msg.length > 160 ? `${msg.slice(0, 157)}…` : msg,
        });
        logWifiDiag("[DeviceConn] WiFi onError: " + msg);
        logRxDestroyIfAny("wifi_onError");
        rxPlaybackHandleRef.current?.destroy();
        rxPlaybackHandleRef.current = null;
        setRxPlaybackEpoch((e) => e + 1);
        setConnecting(false);
        setError(msg);
        setConnectionType((prev) => {
          if (prev === "wifi") setDeviceName(null);
          return prev === "wifi" ? null : prev;
        });
        if (wasWifi) scheduleWifiDropReconnectRef.current("error");
      },
      onData: (data) => onDataRef.current?.(data),
    });
    return () => ws.setCallbacks({});
  }, [
    connectionTypeRef,
    logRxDestroyIfAny,
    onDataRef,
    rxPlaybackHandleRef,
    setConnecting,
    setConnectionType,
    setDeviceName,
    setError,
    setRxPlaybackEpoch,
  ]);
}
