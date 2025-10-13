import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Production: Use vite-plugin-pwa generated Service Worker
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
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
      .catch((error) => {
        console.error('[PWA] Failed to load PWA module:', error);
      });
  } else {
    // Development: Use manual Service Worker (limited offline support)
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Dev SW registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[PWA] Dev SW registration failed:', error);
      });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
