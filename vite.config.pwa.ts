import { defineConfig, mergeConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import baseConfig from "./vite.config";

// Extend base config with PWA plugin for production builds
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Cache all bundled assets (JS, CSS, HTML, fonts, images)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf,jpg,jpeg}'],
          
          // Increase max file size to cache (for photos/images)
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          
          // Runtime caching strategies for dynamic content
          runtimeCaching: [
            // API requests - Network first with offline fallback
            {
              urlPattern: /^.*\/api\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10, // Fallback to cache after 10s
              },
            },
            // Images - Cache first for fast loading
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            // Fonts - Cache first
            {
              urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'font-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
        manifest: {
          name: 'FieldSnaps',
          short_name: 'FieldSnaps',
          description: 'Offline-first photo documentation for construction sites. Capture, compress, and sync photos even with poor connectivity.',
          start_url: '/',
          display: 'standalone',
          background_color: '#FFFFFF',
          theme_color: '#169DF5', // Primary brand color (RGB 22,157,245)
          orientation: 'portrait',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
          ],
          categories: ['productivity', 'photo', 'business', 'utilities'],
        },
      }),
    ],
  })
);
