import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality
// Note: Production builds use vite.config.pwa.ts which provides the PWA module
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Production: Use vite-plugin-pwa generated Service Worker
    // Dynamic import with variable to prevent Vite from analyzing in dev mode
    const pwaModule = 'virtual:pwa-register';
    // @ts-ignore - virtual module only exists in production builds
    import(/* @vite-ignore */ pwaModule)
      .then(({ registerSW }: any) => {
        registerSW({
          onNeedRefresh() {
            console.log('[PWA] New content available, reload to update');
          },
          onOfflineReady() {
            console.log('[PWA] App ready to work offline');
          },
          onRegistered(registration: ServiceWorkerRegistration | undefined) {
            console.log('[PWA] Service Worker registered:', registration?.scope);
          },
          onRegisterError(error: Error) {
            console.error('[PWA] Service Worker registration failed:', error);
          },
        });
      })
      .catch((error: Error) => {
        console.error('[PWA] Failed to load PWA module:', error);
      });
  } else {
    // Development: No Service Worker in dev mode (Vite dev server cannot work offline)
    console.log('[PWA] Service Worker disabled in development mode');
    console.log('[PWA] To test offline: run ./build-pwa.sh and NODE_ENV=production node dist/index.js');
  }
}

createRoot(document.getElementById("root")!).render(<App />);
