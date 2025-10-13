import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service Worker is automatically registered by vite-plugin-pwa in production builds
// The plugin injects a registerSW.js script into index.html that handles registration
// No manual registration needed here - the plugin handles everything

if (import.meta.env.DEV) {
  console.log('[PWA] Service Worker disabled in development mode');
  console.log('[PWA] To test offline: run ./build-pwa.sh then ./start-production.sh');
}

createRoot(document.getElementById("root")!).render(<App />);
