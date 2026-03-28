import { useState } from "react";
import { Bluetooth, Usb, Wifi } from "lucide-react";
import type { BandId } from "@/lib/hardware";
import type { ConnectionType } from "@/contexts/DeviceConnectionContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_WS_PORT = 8765;

interface ConnectionStatusProps {
  connected: boolean;
  /** "usb" | "ble" | "wifi" = how we're connected. */
  connectionType?: ConnectionType;
  /** Band detected from the connected hardware board. Null = no board / unknown. */
  boardBand?: BandId;
  /** When not connected: connect via BLE (shows device picker). */
  onConnectBle?: () => void;
  /** When not connected: connect via USB (shows serial port picker). */
  onConnectUsb?: () => void;
  /** When not connected: connect via WiFi (host + optional port). */
  onConnectWifi?: (host: string, port?: number) => void;
  /** Last saved board host for "Connect to board" one-tap. */
  savedWifiHost?: string | null;
  /** Port to use with saved host. */
  savedWifiPort?: number;
  /** Default host when no saved host (e.g. 192.168.4.1 for board AP). Used for one-tap and form default. */
  defaultWifiHost?: string;
  /** Default port when no saved host (e.g. 8765). */
  defaultWifiPort?: number;
  /** Open the "Set up WiFi" (provisioning) modal. Only shown when BLE is supported. */
  onOpenSetUpWifi?: () => void;
  isBluetoothSupported?: boolean;
  isSerialSupported?: boolean;
  isWifiSupported?: boolean;
  /** Show a connecting state (e.g. spinner or "Connecting…"). */
  connecting?: boolean;
  /** Optional device name when connected via BLE (ignored when connectionType === "usb"). */
  deviceName?: string | null;
  /** If set, show as error state or tooltip (optional). */
  error?: string | null;
}

const ConnectionStatus = ({
  connected,
  connectionType,
  boardBand,
  onConnectBle,
  onConnectUsb,
  onConnectWifi,
  savedWifiHost = null,
  savedWifiPort = DEFAULT_WS_PORT,
  defaultWifiHost = "192.168.4.1",
  defaultWifiPort = DEFAULT_WS_PORT,
  onOpenSetUpWifi,
  isBluetoothSupported = false,
  isSerialSupported = false,
  isWifiSupported = true,
  connecting = false,
  deviceName,
  error,
}: ConnectionStatusProps) => {
  const connectingToRadio = connected && connectionType === "usb" && !boardBand;

  const label = connecting
    ? "Connecting…"
    : connected
      ? connectionType === "usb"
        ? connectingToRadio
          ? "Connecting…"
          : "USB Connected"
        : connectionType === "wifi"
          ? "WiFi Connected"
          : (deviceName ?? "Connected")
      : "Disconnected";

  const canConnect =
    !connected &&
    !connecting &&
    (isBluetoothSupported || isSerialSupported || isWifiSupported);
  const hasMultipleOptions =
    [isBluetoothSupported, isSerialSupported, isWifiSupported].filter(Boolean).length > 1;
  const showChoice = canConnect && (hasMultipleOptions || isWifiSupported);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [wifiFormOpen, setWifiFormOpen] = useState(false);
  const [wifiHost, setWifiHost] = useState(defaultWifiHost);
  const [wifiPort, setWifiPort] = useState(String(defaultWifiPort));

  const handleConnectBle = () => {
    setPopoverOpen(false);
    setWifiFormOpen(false);
    onConnectBle?.();
  };
  const handleConnectUsb = () => {
    setPopoverOpen(false);
    setWifiFormOpen(false);
    onConnectUsb?.();
  };
  const wifiHostToUse = savedWifiHost?.trim() || defaultWifiHost;
  const wifiPortToUse = savedWifiHost ? savedWifiPort : defaultWifiPort;

  const handleConnectToBoard = () => {
    setPopoverOpen(false);
    setWifiFormOpen(false);
    onConnectWifi?.(wifiHostToUse, wifiPortToUse);
  };
  const handleOpenSetUpWifi = () => {
    setPopoverOpen(false);
    setWifiFormOpen(false);
    onOpenSetUpWifi?.();
  };
  const handleOpenWifiForm = () => {
    setWifiHost(defaultWifiHost);
    setWifiPort(String(defaultWifiPort));
    setWifiFormOpen(true);
  };
  const handleConnectWifiSubmit = () => {
    const host = wifiHost.trim();
    if (!host) return;
    const port = parseInt(wifiPort.trim(), 10);
    const portNum = Number.isNaN(port) || port <= 0 ? undefined : port;
    setPopoverOpen(false);
    setWifiFormOpen(false);
    onConnectWifi?.(host, portNum);
  };

  const disconnected = !connected;
  const chip = (
    <div
      className={`glass-panel flex items-center gap-2 rounded-full px-3 py-1.5 ${
        canConnect ? "cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-transform" : ""
      } ${connectingToRadio ? "connection-status-pulse" : ""} ${
        disconnected ? "ring-1 ring-red-500/50 bg-red-950/20" : ""
      }`}
      onClick={
        canConnect && !showChoice
          ? () => (isBluetoothSupported ? onConnectBle?.() : onConnectUsb?.())
          : undefined
      }
      role={canConnect ? "button" : undefined}
      title={error ?? (canConnect ? "Tap to connect" : undefined)}
    >
      <div
        className={`h-1.5 w-1.5 rounded-full transition-colors shrink-0 ${
          connecting
            ? "bg-amber-500 animate-pulse"
            : connected
              ? "bg-signal shadow-[0_0_6px_hsl(142_70%_50%/0.6)] animate-pulse-glow"
              : "bg-red-500"
        }`}
      />
      {connected ? (
        connectionType === "usb" ? (
          <Usb className="h-3 w-3 text-[hsl(var(--signal))] shrink-0" />
        ) : connectionType === "wifi" ? (
          <Wifi className="h-3 w-3 text-[hsl(var(--signal))] shrink-0" />
        ) : (
          <Bluetooth className="h-3 w-3 text-[hsl(var(--signal))] shrink-0" />
        )
      ) : isSerialSupported && !isBluetoothSupported && !isWifiSupported ? (
        <Usb className="h-3 w-3 text-red-400/90 shrink-0" />
      ) : (
        <Wifi className="h-3 w-3 text-red-400/90 shrink-0" />
      )}
      <span
        className={`text-[10px] font-medium uppercase tracking-wider truncate max-w-[100px] ${
          error
            ? "text-destructive"
            : disconnected
              ? "text-red-400"
              : "text-[hsl(var(--signal))]"
        }`}
      >
        {label}
      </span>
    </div>
  );

  if (showChoice) {
    return (
      <div className="flex flex-col items-end gap-1">
        {error && (
          <div className="max-w-[min(100%,280px)] text-right space-y-0.5" role="alert">
            <p className="text-xs text-destructive break-words">{error}</p>
            <p className="text-[10px] text-muted-foreground break-words">
              Join KV4P-Radio, then tap Connect.
            </p>
          </div>
        )}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="rounded-full outline-none focus:ring-0">
              {chip}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-72 p-3">
            {error && (
              <div className="mb-2 px-1 space-y-1" role="alert">
                <p className="text-xs text-destructive break-words">{error}</p>
                <p className="text-[10px] text-muted-foreground break-words">
                  Join KV4P-Radio, then tap Connect.
                </p>
              </div>
            )}
            {!wifiFormOpen ? (
            <>
              <p className="text-sm font-medium text-foreground px-1 py-1 mb-2">Connect via</p>
              {isBluetoothSupported && (
                <p className="text-xs text-muted-foreground px-1 pb-2">
                  After unplugging, wait ~30s before reconnecting for best results.
                </p>
              )}
              {isBluetoothSupported && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={handleConnectBle}
                >
                  <Bluetooth className="h-3.5 w-3.5" />
                  Bluetooth
                </Button>
              )}
              {isSerialSupported && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={handleConnectUsb}
                >
                  <Usb className="h-3.5 w-3.5" />
                  USB (cable)
                </Button>
              )}
              {isWifiSupported && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={handleConnectToBoard}
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    Connect to board
                  </Button>
                  <p className="text-[10px] text-muted-foreground px-2 -mt-0.5">
                    Join KV4P-Radio, then tap Connect.
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 w-full text-left"
                    onClick={handleOpenWifiForm}
                  >
                    Enter address manually
                  </button>
                  <p className="text-[10px] text-muted-foreground px-1 pt-1 border-t border-border/50 mt-1">
                    Join KV4P-Radio, then tap Connect. Add to home screen for offline use.
                  </p>
                  {isBluetoothSupported && onOpenSetUpWifi && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-muted-foreground"
                      onClick={handleOpenSetUpWifi}
                    >
                      <Wifi className="h-3.5 w-3.5" />
                      Set up WiFi (Bluetooth)
                    </Button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground px-1 py-1 mb-2">Board address (WiFi)</p>
              <p className="text-xs text-muted-foreground px-1 pb-2">Join KV4P-Radio, then tap Connect. You can enter a different host/port if needed.</p>
              <div className="space-y-2">
                <Input
                  placeholder="e.g. 192.168.4.1"
                  value={wifiHost}
                  onChange={(e) => setWifiHost(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                />
                <Input
                  placeholder="Port"
                  type="number"
                  value={wifiPort}
                  onChange={(e) => setWifiPort(e.target.value)}
                  className="h-9 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWifiFormOpen(false)}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleConnectWifiSubmit}
                    disabled={!wifiHost.trim()}
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
      </div>
    );
  }

  const isCode1006 = error?.includes("1006") ?? false;

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <div className="max-w-[min(100%,280px)] text-right space-y-0.5" role="alert">
          <p className="text-xs text-destructive break-words">{error}</p>
          {isCode1006 ? (
            <p className="text-[10px] text-muted-foreground break-words">
              Wait 5–10 s after joining KV4P-Radio, then try again. Ensure the board is powered and has finished booting (Serial: &quot;Setup is finished&quot;).
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground break-words">
              Join KV4P-Radio, then tap Connect.
            </p>
          )}
        </div>
      )}
      {chip}
    </div>
  );
};

export default ConnectionStatus;
