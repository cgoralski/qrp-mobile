import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSessionLog, logSession } from "@/lib/session-log";

initSessionLog();
logSession("main.tsx bundle executed");

declare global {
  interface Window {
    __capDiag?: (text: string, isError?: boolean) => void;
  }
}

function diag(text: string, isError?: boolean) {
  window.__capDiag?.(text, isError);
}

function removeDiag() {
  const el = document.getElementById("cap-diag");
  el?.remove();
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  componentDidCatch(error: Error) {
    diag(`React error: ${error.message}`, true);
    logSession("React RootErrorBoundary", { error: error.message.slice(0, 240) });
  }

  render() {
    if (this.state.message) {
      removeDiag();
      return (
        <div style={{ padding: 16, color: "#f87171", background: "#0f172a", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
          <strong>UI error</strong>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{this.state.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

try {
  diag("Module loaded — mounting React…");
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    diag("Missing #root element in index.html", true);
    logSession("main missing #root", { fatal: true });
  } else {
    createRoot(rootEl).render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>,
    );
    logSession("createRoot.render(App) called");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        removeDiag();
        logSession("main first paint rAF (diag overlay cleared)");
      });
    });
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  diag(`Fatal: ${msg}`, true);
  logSession("main fatal", { error: msg.slice(0, 200) });
}
