import { Usb } from "lucide-react";

interface ConnectionStatusProps {
  connected: boolean;
}

const ConnectionStatus = ({ connected }: ConnectionStatusProps) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          connected
            ? "bg-signal animate-pulse-glow"
            : "bg-muted-foreground"
        }`}
      />
      <Usb className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {connected ? "Connected" : "No device"}
      </span>
    </div>
  );
};

export default ConnectionStatus;
