#!/bin/bash

echo "🚀 Starting FieldSnaps Production Server..."
echo ""

# Check if build exists
if [ ! -d "dist/public" ]; then
    echo "❌ Production build not found. Running build first..."
    ./build-pwa.sh
fi

# Stop dev server if running
echo "Stopping dev server..."
pkill -f "tsx server/index.ts" 2>/dev/null || true

# Start production server
echo "Starting production server on port 5000..."
NODE_ENV=production node dist/index.js
