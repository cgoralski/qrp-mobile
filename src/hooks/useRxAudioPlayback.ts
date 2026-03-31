import { useEffect } from "react";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useKv4p } from "@/contexts/Kv4pContext";
import { RadioLinkKeepAlive } from "@/plugins/radio-link-keepalive";

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

  // WKWebView may re-suspend AudioContext while the screen is locked; poke resume + speaker route periodically.
  useEffect(() => {
    if (!connected || !usePlayback) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        void RadioLinkKeepAlive.ensureSpeakerOutput();
        void rxPlaybackHandleRef.current?.resumeIfSuspended();
      }
    }, 800);
    return () => clearInterval(id);
  }, [connected, usePlayback, rxPlaybackEpoch, rxPlaybackHandleRef]);
}
