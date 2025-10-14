/**
 * Enhanced Service Worker for FieldSnaps Construction Photo PWA
 * 
 * Provides:
 * - Offline-first functionality
 * - Intelligent caching strategies
 * - Background sync for photo uploads
 * - Cache management and cleanup
 */

const APP_VERSION = 'v1.1.0';
const CACHE_PREFIX = 'fieldsnaps-pwa';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${APP_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${APP_VERSION}`;

// Assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Cache size limits (in items)
const CACHE_LIMITS = {
  [DYNAMIC_CACHE]: 50,
  [IMAGE_CACHE]: 100,
};

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
};

/**
 * Install event - pre-cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', APP_VERSION);
  
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...', APP_VERSION);
  
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete caches that don't match current version
            if (cacheName.startsWith(CACHE_PREFIX) && !cacheName.includes(APP_VERSION)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

/**
 * Determine caching strategy based on request
 */
function getCacheStrategy(request) {
  const url = new URL(request.url);
  
  // API requests - network first (fresh data preferred)
  if (url.pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Static assets (JS, CSS, fonts) - cache first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // Images - cache first (photos, icons)
  if (request.destination === 'image') {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // HTML - stale while revalidate (show cached, update in background)
  if (request.destination === 'document') {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }
  
  // Default - network first
  return CACHE_STRATEGIES.NETWORK_FIRST;
}

/**
 * Get appropriate cache name for request
 */
function getCacheName(request) {
  if (request.destination === 'image') {
    return IMAGE_CACHE;
  }
  
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'document'
  ) {
    return STATIC_CACHE;
  }
  
  return DYNAMIC_CACHE;
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed for:', request.url, error);
    
    // Return offline fallback for HTML
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      const fallback = await cache.match('/');
      if (fallback) {
        return fallback;
      }
    }
    
    throw error;
  }
}

/**
 * Network-first strategy
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for HTML
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match('/');
    }
    
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(cacheName);
        cache.then((c) => c.put(request, networkResponse.clone()));
        limitCacheSize(cacheName);
      }
      return networkResponse;
    })
    .catch(async (error) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      if (request.destination === 'document') {
        const cache = await caches.open(STATIC_CACHE);
        const fallback = await cache.match('/');
        if (fallback) {
          return fallback;
        }
      }
      
      return new Response('Offline - No cached content available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/plain',
        }),
      });
    });
  
  if (cachedResponse) {
    fetchPromise.catch(() => {});
    return cachedResponse;
  }
  
  return fetchPromise;
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName) {
  const limit = CACHE_LIMITS[cacheName];
  
  if (!limit) return;
  
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > limit) {
    const keysToDelete = keys.slice(0, keys.length - limit);
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));
  }
}

/**
 * Fetch event - apply caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const strategy = getCacheStrategy(request);
  const cacheName = getCacheName(request);
  
  if (request.method !== 'GET') {
    return;
  }
  
  if (!request.url.startsWith('http')) {
    return;
  }
  
  let responsePromise;
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      responsePromise = cacheFirst(request, cacheName);
      break;
      
    case CACHE_STRATEGIES.NETWORK_FIRST:
      responsePromise = networkFirst(request, cacheName);
      break;
      
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      responsePromise = staleWhileRevalidate(request, cacheName);
      break;
      
    case CACHE_STRATEGIES.NETWORK_ONLY:
    default:
      responsePromise = fetch(request);
      break;
  }
  
  event.respondWith(responsePromise);
});

/**
 * Background Sync - for photo uploads when connection returns
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-photos') {
    event.waitUntil(syncPhotos());
  }
});

async function syncPhotos() {
  try {
    const clients = await self.clients.matchAll();
    
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_PHOTOS',
        timestamp: Date.now(),
      });
    });
  } catch (error) {
    console.error('[SW] Photo sync failed:', error);
    throw error;
  }
}

/**
 * Message handler - for client communication
 */
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith(CACHE_PREFIX)) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});

console.log('[SW] FieldSnaps Service Worker loaded', APP_VERSION);
