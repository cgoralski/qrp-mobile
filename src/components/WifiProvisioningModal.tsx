import { useState, useCallback } from "react";
import { Bluetooth, Loader2, Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  openProvisioningConnection,
  type ProvisioningConnection,
  isProvisioningSupported,
} from "@/lib/wifi-provisioning";
import { setSavedWifiHost } from "@/lib/wifi-storage";

interface WifiProvisioningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with board IP after provisioning; parent should connectViaWifi(ip). */
  onSuccess: (ip: string) => void;
}

export default function WifiProvisioningModal({
  open,
  onOpenChange,
  onSuccess,
}: WifiProvisioningModalProps) {
  const [bleConnected, setBleConnected] = useState(false);
  const [provConnection, setProvConnection] = useState<ProvisioningConnection | null>(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting_ble" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    provConnection?.close();
    setProvConnection(null);
    setBleConnected(false);
    setSsid("");
    setPassword("");
    setStatus("idle");
    setError(null);
  }, [provConnection]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const handleConnectBle = useCallback(async () => {
    if (!isProvisioningSupported()) {
      setError("Bluetooth is not available. Use HTTPS and a supported browser.");
      return;
    }
    setError(null);
    setStatus("connecting_ble");
    try {
      const conn = await openProvisioningConnection();
      setProvConnection(conn);
      setBleConnected(true);
      setStatus("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("idle");
    }
  }, []);

  const handleSubmitCredentials = useCallback(async () => {
    const s = ssid.trim();
    if (!s) {
      setError("Enter the WiFi network name (SSID).");
      return;
    }
    if (!provConnection) return;
    setError(null);
    setStatus("sending");
    try {
      const ip = await provConnection.sendCredentials(s, password);
      provConnection.close();
      setProvConnection(null);
      setBleConnected(false);
      setSavedWifiHost(ip);
      setStatus("done");
      onSuccess(ip);
      handleOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("idle");
    }
  }, [ssid, password, provConnection, onSuccess, handleOpenChange]);

  const statusMessage =
    status === "connecting_ble"
      ? "Connecting via Bluetooth…"
      : status === "sending"
        ? "Connecting board to WiFi…"
        : bleConnected
          ? "Enter your WiFi details below."
          : "Connect to the board via Bluetooth first, then enter your WiFi network name and password.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Set up WiFi
          </DialogTitle>
          <DialogDescription>{statusMessage}</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {!bleConnected ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleConnectBle}
              disabled={status === "connecting_ble"}
            >
              {status === "connecting_ble" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              {status === "connecting_ble" ? "Connecting…" : "Connect via Bluetooth"}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Network name (SSID)</label>
                <Input
                  placeholder="e.g. MyHomeWiFi"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="WiFi password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handleSubmitCredentials}
                disabled={status === "sending" || !ssid.trim()}
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting board…
                  </>
                ) : (
                  "Connect board to WiFi"
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
