# PhotoPWA - Mobile Photo Management App

## Overview
A Progressive Web App (PWA) for professional photo management with annotation tools, optimized for mobile use. Built with React, TypeScript, and PostgreSQL.

## Project Setup Complete ✅
- **Database**: PostgreSQL (Replit built-in)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Drizzle ORM
- **PWA Features**: Installable on mobile devices

## Key Features
- 📱 **Mobile-First Design**: Optimized for phone and tablet use
- 📸 **Photo Upload**: Capture photos directly from camera (mobile) or upload files
- ✏️ **Annotation Tools**: Text, Arrow, Line, Circle, and Pen drawing tools
- 📁 **Project Organization**: Group photos by project
- 💬 **Comments**: Add comments to photos
- 📲 **PWA**: Install as a standalone app on your device

## Current Status
- ✅ Database schema created (projects, photos, annotations, comments)
- ✅ Backend API routes configured
- ✅ Frontend pages and components ready
- ✅ App running on port 5000

## How to Use

### On Desktop
1. Open the app in your browser
2. Create a new project
3. Upload photos or use the file picker
4. Click a photo to annotate it

### On Mobile (Recommended)
1. Open the app in Safari (iOS) or Chrome (Android)
2. **Install as PWA**:
   - **iOS**: Tap Share → "Add to Home Screen"
   - **Android**: Tap Menu → "Add to Home Screen"
3. Open the app from your home screen
4. Create a project and tap "Add Photo" to use your camera

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Routing**: Wouter
- **Data Fetching**: TanStack Query
- **PWA**: Service Worker + Web Manifest

## Development

### Running the App
The app runs automatically via the "Start application" workflow:
```bash
npm run dev
```

### Database Management
```bash
# Push schema changes
npm run db:push

# View database in Drizzle Studio
npm run db:studio
```

## Project Structure
```
client/
  src/
    components/       # React components
    pages/           # Page components (Projects, ProjectPhotos)
    lib/             # Utilities and query client
server/
  db.ts            # Database connection
  routes.ts        # API endpoints
  storage.ts       # Data access layer
shared/
  schema.ts        # Database schema & types
public/
  manifest.json    # PWA manifest
  sw.js           # Service worker
```

## API Endpoints
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `GET /api/projects/:projectId/photos` - List project photos
- `POST /api/projects/:projectId/photos` - Upload photo
- `DELETE /api/photos/:id` - Delete photo
- `GET /api/photos/:photoId/annotations` - Get annotations
- `POST /api/photos/:photoId/annotations` - Create annotation
- `DELETE /api/annotations/:id` - Delete annotation
- `GET /api/photos/:photoId/comments` - Get comments
- `POST /api/photos/:photoId/comments` - Create comment

## Next Steps (Future Enhancements)
1. **Cloud Storage**: Replace blob URLs with Replit Object Storage or S3
2. **Offline Support**: Enhanced service worker for offline photo queue
3. **Real-time Collaboration**: WebSockets for live updates
4. **PDF Reports**: Generate reports with annotated photos
5. **Photo Filters**: Add image editing capabilities

## Notes
- Photos are currently stored as blob URLs (temporary)
- For production, implement cloud storage for persistent photo storage
- The app is fully responsive and works on all screen sizes
- Camera access requires HTTPS (Replit provides this automatically)

---
Last updated: October 11, 2025
