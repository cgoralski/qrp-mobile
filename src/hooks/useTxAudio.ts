import { useEffect, useRef } from "react";
import { startTxAudio } from "@/lib/tx-audio";

/**
 * When active is true and onEncodedFrame is set, captures microphone, encodes to Opus
 * (40 ms frames), and calls onEncodedFrame for each frame. Stops when active becomes false.
 * Used for PTT TX audio over USB/BLE.
 */
export function useTxAudio(
  active: boolean,
  onEncodedFrame: ((data: Uint8Array) => void) | null
): void {
  const handleRef = useRef<Awaited<ReturnType<typeof startTxAudio>> | null>(null);

  useEffect(() => {
    if (!active || !onEncodedFrame) {
      handleRef.current?.stop();
      handleRef.current = null;
      return;
    }

    let cancelled = false;
    startTxAudio((data) => {
      if (!cancelled) onEncodedFrame(data);
    })
      .then((handle) => {
        if (cancelled) {
          handle.stop();
          return;
        }
        handleRef.current = handle;
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[TX audio] Start failed:", err);
        }
      });

    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [active, onEncodedFrame]);
}
