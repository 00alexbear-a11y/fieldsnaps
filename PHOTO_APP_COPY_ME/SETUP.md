# PhotoPWA - Quick Setup Guide

## 🚀 Copy to New Replit (5 Minutes)

### Step 1: Copy Files
1. **In your new Replit project**, delete all default files
2. **Copy this entire `photo-app` folder** to the root of your new Replit
3. Move all contents from `photo-app/` to the root (optional, or keep it nested)

### Step 2: Environment Setup
In Replit Secrets (or `.env`), add:
```
DATABASE_URL=your_neon_database_url_here
```

### Step 3: Install & Run
```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start the app
npm run dev
```

That's it! Your app should be running on port 5000.

## 📱 Mobile Testing

### Install as PWA
1. **iOS**: Open in Safari → Share → Add to Home Screen
2. **Android**: Open in Chrome → Menu → Add to Home Screen

### Test Camera Capture
- Click "Add Photo" button - it will open your device camera
- Take a photo to test upload
- Click the photo to open annotation editor

### Test Touch Annotations
- Tap to select a tool (Text, Arrow, Line, Circle, Pen)
- Touch and drag to create annotations
- Tap annotation handles to move/resize

## ✅ Verification Checklist

After setup, verify:
- [ ] App loads at `localhost:5000` or your Replit URL
- [ ] Can create a new project
- [ ] Can upload a photo (camera on mobile, file picker on desktop)
- [ ] Can open annotation editor
- [ ] Can draw annotations (test each tool)
- [ ] Annotations save correctly
- [ ] PWA installs on mobile device

## 🛠 Troubleshooting

**Database Error:**
- Check DATABASE_URL is set correctly in Secrets
- Run `npm run db:push --force` if schema sync fails

**Photos Not Uploading:**
- Current implementation uses blob URLs (temporary)
- For production, implement cloud storage (see README.md)

**Annotations Not Saving:**
- Check browser console for errors
- Verify database connection
- Check API routes are responding (Network tab)

**Touch Controls Not Working:**
- Test on actual mobile device, not just desktop browser
- Ensure you're using HTTPS (Replit provides this automatically)

## 📦 What's Included

### Frontend
- ✅ React + TypeScript + Vite
- ✅ TanStack Query for data fetching
- ✅ Wouter for routing
- ✅ Tailwind CSS + shadcn/ui
- ✅ Touch-optimized annotation tools
- ✅ PWA manifest & service worker

### Backend
- ✅ Express.js + TypeScript
- ✅ Drizzle ORM
- ✅ PostgreSQL (Neon)
- ✅ RESTful API

### Features
- ✅ Project organization
- ✅ Photo upload (blob URLs)
- ✅ 5 annotation tools (Text, Arrow, Line, Circle, Pen)
- ✅ Touch support for mobile
- ✅ Comments system
- ✅ PWA installable

## 🎯 Next Steps

1. **Cloud Storage**: Replace blob URLs with Replit Object Storage or S3
2. **Offline Support**: Enhance service worker for offline photo queue
3. **Collaboration**: Add real-time updates with WebSockets
4. **Reports**: Generate PDF reports with annotated photos

## 📚 File Structure

```
photo-app/
├── client/          # Frontend React app
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── hooks/
│   └── index.html
├── server/          # Backend Express app
│   ├── index.ts
│   ├── routes.ts
│   └── storage.ts
├── shared/
│   └── schema.ts    # Shared types
├── public/          # PWA assets
│   ├── manifest.json
│   └── sw.js
└── package.json
```

## 🔗 Resources

- **README.md** - Full documentation
- **API Documentation** - See README.md for all endpoints
- **Component Docs** - shadcn/ui documentation

---

**Need Help?** Check the README.md for detailed documentation and troubleshooting.
