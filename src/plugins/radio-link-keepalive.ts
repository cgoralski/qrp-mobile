/**
 * Native keep-alive while connected to the board over Wi‑Fi so the OS does not
 * suspend the app / starve the WebSocket when the screen turns off.
 * Android: foreground service + partial wake lock + Wi‑Fi lock.
 * iOS: audio background mode + low-volume looping silence (AVAudioSession).
 */
import { registerPlugin } from "@capacitor/core";

export interface RadioLinkKeepAlivePlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

export const RadioLinkKeepAlive = registerPlugin<RadioLinkKeepAlivePlugin>("RadioLinkKeepAlive", {
  web: {
    enable: async () => {
      /* PWA: browser cannot hold LAN socket across sleep */
    },
    disable: async () => {},
  },
});
