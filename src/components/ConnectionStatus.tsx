import { Usb, Bluetooth } from "lucide-react";

interface ConnectionStatusProps {
  connected: boolean;
}

const ConnectionStatus = ({ connected }: ConnectionStatusProps) => {
  return (
    <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-1.5">
      <div
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          connected
            ? "bg-signal shadow-[0_0_6px_hsl(142_70%_50%/0.6)] animate-pulse-glow"
            : "bg-muted-foreground/50"
        }`}
      />
      <Usb className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {connected ? "Connected" : "No device"}
      </span>
    </div>
  );
};

export default ConnectionStatus;
