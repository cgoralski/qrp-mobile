import { useEffect } from "react";
import { useDeviceConnection } from "@/contexts/DeviceConnectionContext";
import { useKv4p } from "@/contexts/Kv4pContext";

/**
 * When connected (USB): wire the context's RX playback handle to the KV4P callback so
 * audio chunks are played. Handle is created when user clicks Connect (USB).
 * When disconnected: clear callback; context owns and tears down the handle.
 */
export function useRxAudioPlayback(): void {
  const { connected, connectionType, rxPlaybackHandleRef } = useDeviceConnection();
  const { setOnRxAudio } = useKv4p();

  useEffect(() => {
    if (!connected || connectionType !== "usb") {
      setOnRxAudio(null);
      return;
    }

    const handle = rxPlaybackHandleRef.current;
    if (handle) {
      setOnRxAudio((data) => handle.pushChunk(data));
      console.log("[RX audio] playback ready");
    }

    return () => {
      setOnRxAudio(null);
    };
  }, [connected, connectionType, rxPlaybackHandleRef, setOnRxAudio]);
}
