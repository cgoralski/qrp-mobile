import { useEffect, useRef, type MutableRefObject } from "react";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useKv4p } from "@/contexts/Kv4pContext";
import { RadioLinkKeepAlive } from "@/plugins/radio-link-keepalive";
import { getSavedWifiHost, getSavedWifiPort } from "@/lib/wifi-storage";
import { logSession } from "@/lib/session-log";
import type { RxPlaybackHandle } from "@/lib/rx-audio-playback";

/**
 * When connected over USB or Wi‑Fi: wire the RX playback handle to KV4P CMD_RX_AUDIO.
 * Ref is assigned asynchronously after connect; `rxPlaybackEpoch` bumps so we attach once the handle exists.
 */
export function useRxAudioPlayback(): void {
  const { connected, connectionType, rxPlaybackHandleRef, rxPlaybackEpoch } = useDeviceConnection();
  const { setOnRxAudio } = useKv4p();

  const usePlayback = connectionType === "usb" || connectionType === "wifi";

  useEffect(() => {
    if (!connected || !usePlayback) {
      setOnRxAudio(null);
      return;
    }

    const handle = rxPlaybackHandleRef.current;
    if (handle) {
      setOnRxAudio((data) => handle.pushChunk(data));
      console.log("[RX audio] playback ready (" + connectionType + ")");
    }

    return () => {
      setOnRxAudio(null);
    };
  }, [connected, connectionType, usePlayback, rxPlaybackEpoch, rxPlaybackHandleRef, setOnRxAudio]);

  // Screen lock / visibility: resume Web Audio if the OS suspended it; iOS native speaker route refresh.
  useEffect(() => {
    if (!connected || !usePlayback) return;

    const refreshAudioForLockCycle = () => {
      void RadioLinkKeepAlive.ensureSpeakerOutput();
      const h = rxPlaybackHandleRef.current;
      if (h) void h.resumeIfSuspended();
    };

    document.addEventListener("visibilitychange", refreshAudioForLockCycle);
    window.addEventListener("pageshow", refreshAudioForLockCycle);
    window.addEventListener("focus", refreshAudioForLockCycle);

    return () => {
      document.removeEventListener("visibilitychange", refreshAudioForLockCycle);
      window.removeEventListener("pageshow", refreshAudioForLockCycle);
      window.removeEventListener("focus", refreshAudioForLockCycle);
    };
  }, [connected, usePlayback, rxPlaybackEpoch, rxPlaybackHandleRef]);

  // WKWebView may re-suspend Web Audio when locked; keep interval coarse so we do not add ~1s cadence
  // load on the bridge / audio session while visible (some WebViews report visibility oddly).
  useEffect(() => {
    if (!connected || !usePlayback) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        void RadioLinkKeepAlive.ensureSpeakerOutput();
        void rxPlaybackHandleRef.current?.resumeIfSuspended();
      }
    }, 4000);
    return () => clearInterval(id);
  }, [connected, usePlayback, rxPlaybackEpoch, rxPlaybackHandleRef]);
}

/**
 * Call from the **same synchronous turn** as PTT release (pointer/touch up) so browser Web Audio
 * `resume()` still qualifies as a user gesture. Delayed timers (see `usePostPttRxRecovery`) are not
 * enough: after TX stops, `resume()` is often ignored and RX stays silent.
 * iOS native: immediately rebuild AVAudioEngine / session (`ensureReady`); complements the delayed
 * Wi‑Fi recycle in `usePostPttRxRecovery` when needed.
 */
export function resumeRxPlaybackAfterPttRelease(
  rxPlaybackHandleRef: MutableRefObject<RxPlaybackHandle | null>
): void {
  void rxPlaybackHandleRef.current?.resumeIfSuspended();
  void (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
        const { RxPcmAudio } = await import("@/plugins/rx-pcm-audio");
        await RxPcmAudio.ensureReady();
        await RadioLinkKeepAlive.ensureSpeakerOutput();
      }
    } catch {
      /* ignore */
    }
  })();
}

/**
 * WKWebView TX uses getUserMedia + AudioContext, which reconfigures AVAudioSession on iOS. On Wi‑Fi,
 * users still saw RX dead until a full "Connect to board" (new native WebSocket + new RX playback +
 * KV4P handshake). `RxPcmAudio.ensureReady()` alone was not enough; recycle the Wi‑Fi link here.
 * USB: keep native engine restore only.
 *
 * Runs after a short delay; pair with `resumeRxPlaybackAfterPttRelease` on PTT up for gesture-safe
 * Web Audio resume and immediate native engine rebuild.
 */
export function usePostPttRxRecovery(isTransmitting: boolean): void {
  const { connected, connectionType, rxPlaybackHandleRef, connectViaWifi } = useDeviceConnection();
  const prevTx = useRef(false);
  const usePlayback = connectionType === "usb" || connectionType === "wifi";
  const connectionTypeRef = useRef(connectionType);
  const connectedRef = useRef(connected);
  connectionTypeRef.current = connectionType;
  connectedRef.current = connected;

  useEffect(() => {
    const wasTx = prevTx.current;
    prevTx.current = isTransmitting;
    if (!connected || !usePlayback) return;
    if (!wasTx || isTransmitting) return;

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const { Capacitor } = await import("@capacitor/core");
          if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
            if (connectionTypeRef.current === "wifi" && connectedRef.current) {
              const host = getSavedWifiHost();
              if (host) {
                logSession("post_ptt_ios_wifi_recycle", { host: host.slice(0, 48) });
                await connectViaWifi(host, getSavedWifiPort());
                return;
              }
            }
            const { RxPcmAudio } = await import("@/plugins/rx-pcm-audio");
            await RxPcmAudio.ensureReady();
            void RadioLinkKeepAlive.ensureSpeakerOutput();
            return;
          }
        } catch (e) {
          console.warn("[RX audio] post-PTT restore failed:", e);
        }
        void rxPlaybackHandleRef.current?.resumeIfSuspended();
      })();
    }, 400);

    return () => window.clearTimeout(t);
  }, [isTransmitting, connected, usePlayback, rxPlaybackHandleRef, connectViaWifi]);
}
