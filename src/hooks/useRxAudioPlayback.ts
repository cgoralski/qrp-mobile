import { useEffect } from "react";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useKv4p } from "@/contexts/Kv4pContext";

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
}
