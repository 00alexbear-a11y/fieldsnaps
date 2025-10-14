import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

// Register Service Worker for offline functionality
registerServiceWorker().catch((error) => {
  console.error('[PWA] Failed to register Service Worker:', error);
});

createRoot(document.getElementById("root")!).render(<App />);
