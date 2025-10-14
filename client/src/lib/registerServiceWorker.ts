/**
 * Service Worker Registration Module
 * 
 * Handles registration of the manual Service Worker for offline functionality
 * Only registers in production builds
 */

export async function registerServiceWorker() {
  // Only register in production and if Service Workers are supported
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    if (import.meta.env.DEV) {
      console.log('[PWA] Service Worker disabled in development mode');
      console.log('[PWA] To test offline: build with vite build and serve with NODE_ENV=production');
    }
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service Worker registered successfully:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available, please refresh');
            
            // Optionally show update notification to user
            // You can dispatch a custom event here to show a toast/banner
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Listen for messages from Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_PHOTOS') {
        console.log('[PWA] Received sync request from Service Worker');
        // Trigger photo sync - dispatch event that syncManager can listen to
        window.dispatchEvent(new CustomEvent('sw-sync-request'));
      }
    });

    // Check if there's an active Service Worker
    if (registration.active) {
      console.log('[PWA] Service Worker is active and ready');
    }

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    throw error;
  }
}

/**
 * Unregister the Service Worker (for debugging/testing)
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  
  for (const registration of registrations) {
    await registration.unregister();
    console.log('[PWA] Service Worker unregistered');
  }
}

/**
 * Clear all caches (for debugging/testing)
 */
export async function clearAllCaches() {
  if (!('caches' in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  
  await Promise.all(
    cacheNames.map((cacheName) => caches.delete(cacheName))
  );
  
  console.log('[PWA] All caches cleared');
}
