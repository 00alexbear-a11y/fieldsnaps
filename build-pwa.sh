#!/bin/bash

# Build FieldSnaps PWA for production with offline support
echo "🚀 Building FieldSnaps PWA..."

# Clean dist folder
rm -rf dist

# Build frontend with PWA plugin
echo "📦 Building frontend with PWA..."
vite build --config vite.config.pwa.ts

# Build backend
echo "🔧 Building backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "✅ Build complete! PWA ready in dist/public"
echo ""
echo "To test offline functionality:"
echo "1. Run: NODE_ENV=production node dist/index.js"
echo "2. Open the URL in your browser"
echo "3. Add to home screen (iOS Safari: Share > Add to Home Screen)"
echo "4. Enable airplane mode and test!"
