import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { DeviceConnectionProvider } from "@/contexts/DeviceConnectionContext";
import { SerialLogProvider } from "@/contexts/SerialLogContext";
import { Kv4pProvider } from "@/contexts/Kv4pContext";
import { RxAudioPlaybackHost } from "@/components/RxAudioPlaybackHost";
import { SessionLifecycleLogger } from "@/components/SessionLifecycleLogger";

const Index = lazy(() => import("./pages/Index"));
const WifiConsolePage = lazy(() => import("./pages/WifiConsolePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const routeFallback = (
  <div className="min-h-screen min-h-dvh bg-[#0f172a]" aria-busy="true" />
);

const queryClient = new QueryClient();

/** BrowserRouter can fail with capacitor://; HashRouter is reliable in WKWebView. */
const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <SerialLogProvider>
          <DeviceConnectionProvider>
            <Kv4pProvider>
            <SessionLifecycleLogger />
            <RxAudioPlaybackHost />
            <Suspense fallback={routeFallback}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/wifi-console" element={<WifiConsolePage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </Kv4pProvider>
          </DeviceConnectionProvider>
        </SerialLogProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
