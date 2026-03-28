import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vk4cgo.qrpmobile',
  appName: 'QRP Mobile',
  // Native builds write to dist-native/ (see vite --mode capacitor). Do not use dist/ — that is the PWA/site
  // build and includes leaflet-*.js chunks that break WKWebView.
  webDir: 'dist-native',
  ios: {
    // Without this, Release/TestFlight builds set WKWebView.isInspectable = false (iOS 16.4+),
    // so Safari → Develop shows the app but Console stays empty. Disable for hardened prod if you prefer.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
