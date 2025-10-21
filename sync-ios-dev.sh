#!/bin/bash
# Quick script to sync iOS with dev server connection

echo "🔨 Building web app..."
npm run build

echo ""
echo "🔄 Switching to dev config..."
cp capacitor.config.ts capacitor.config.prod.ts
cp capacitor.config.dev.ts capacitor.config.ts

echo ""
echo "📱 Syncing iOS..."
npx cap sync ios

echo ""
echo "🔄 Restoring production config..."
cp capacitor.config.prod.ts capacitor.config.ts

echo ""
echo "✅ Done! Now run: npx cap open ios"
echo ""
echo "Your iOS app will connect to:"
echo "https://b031dd5d-5c92-4902-b04b-e2a8255614a2-00-1nc5d7i5pn8nb.picard.replit.dev"
