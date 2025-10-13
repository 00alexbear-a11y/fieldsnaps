import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  // Register immediately, don't wait for load event (more reliable in dev mode)
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope);
      
      // Log SW state
      console.log('[PWA] SW state:', registration.active?.state);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update().then(() => {
          console.log('[PWA] SW update check completed');
        });
      }, 60 * 60 * 1000);
      
      // Listen for SW updates
      registration.addEventListener('updatefound', () => {
        console.log('[PWA] SW update found');
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[PWA] SW state changed to:', newWorker.state);
          });
        }
      });
    })
    .catch((error) => {
      console.error('[PWA] Service Worker registration failed:', error);
    });

  // Listen for controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Service Worker controller changed');
  });
}

createRoot(document.getElementById("root")!).render(<App />);
