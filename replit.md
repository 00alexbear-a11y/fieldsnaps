# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired, premium Progressive Web App (PWA) designed for construction professionals to capture and document job sites. Its core purpose is to provide an extremely simple, offline-reliable, and effortless photo documentation experience, focusing on instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app aims for complete offline functionality, touch optimization for work gloves, and reliability in challenging environments, ultimately enhancing efficiency and reducing disputes in construction projects.

## Recent Changes

### Offline PWA Implementation - Manual Service Worker (October 14, 2025)
**IMPLEMENTATION:** Complete offline functionality using manual Service Worker approach.

**Architecture:**
- **Manual Service Worker** (`client/public/sw.js`) - Comprehensive offline-first implementation
- **Registration Module** (`client/src/lib/registerServiceWorker.ts`) - Production-only registration with update handling
- **Main.tsx Integration** - Automatic Service Worker registration on app load
- Vite automatically copies `client/public/sw.js` to `dist/public/sw.js` during build

**Why Manual Service Worker?**
- `vite.config.ts` and `package.json` are protected files (cannot be modified)
- vite-plugin-pwa requires config changes, so manual SW is the workaround
- Placing SW in `client/public/` ensures Vite copies it during standard build process
- No build configuration changes needed - works with existing locked config

**Service Worker Features:**
- **Version:** v1.1.0 with automatic cache versioning
- **Cache Strategies:**
  - Static assets (JS, CSS, fonts): Cache-first
  - API requests: Network-first with cache fallback
  - HTML pages: Stale-while-revalidate
  - Images: Cache-first with size limits
- **Cache Limits:** 50 dynamic items, 100 images
- **Background Sync:** Photo upload queue when connection returns
- **Offline Fallbacks:** Graceful degradation for all resource types

**Build & Test Instructions:**

**IMPORTANT:** The development preview URL will NEVER work offline (Vite dev server limitation). You MUST use the production build to test offline functionality.

**Quick Build & Test:**
```bash
# Build production version (includes backend + frontend)
vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Start production server (stops dev server automatically)
./start-production.sh
```

**Or use the convenience script:**
```bash
./build-pwa.sh        # Builds everything
./start-production.sh # Stops dev, starts production on port 5000
```

**Testing Offline on iPhone:**
1. **Build & start production server** (see commands above)
2. **Open production URL** in Safari (NOT the dev preview URL)
3. **Add to Home Screen**: Share → "Add to Home Screen"
4. **Open from home screen** (standalone mode)
5. **Enable Airplane Mode** ✈️
6. **App works offline!** ✅

**Troubleshooting:**
- Dev preview URL (*.picard.replit.dev) → Won't work offline (expected behavior)
- If you added dev preview to home screen → Remove it and add production URL
- Check browser console for `[PWA] Service Worker registered successfully`
- Verify `sw.js` exists at production URL by visiting `/sw.js`

**Technical Implementation:**
- SW caches all static assets during install event
- Intelligent fetch interception with strategy selection
- Automatic cache cleanup on version updates
- Message-based communication for sync coordination
- Update notifications via `sw-update-available` event

### Auto-Sync Improvements & Manual Sync Button (October 13, 2025)
Enhanced background sync system with faster auto-sync and manual control:

**Auto-Sync Improvements:**
- Made photo sync non-blocking for immediate UI responsiveness after capture
- Sync now triggers instantly without blocking the capture flow or navigation
- Added proper error handling with user-facing toast notifications when sync queueing fails
- Error toast instructs users to "Try manual sync" if auto-sync queue fails
- Console logging maintained for debugging sync issues

**Manual Sync Button:**
- Added small sync button (RefreshCw icon, h-8 w-8) to Projects page header
- Positioned before "New Project" button for easy access
- Shows spinning animation while sync is in progress
- Provides detailed toast feedback:
  - "✓ Synced" with item count when items uploaded successfully
  - "Up to date" when all items are already synced
  - "Sync incomplete" with failure count when some items fail
  - "Sync failed" with error message on complete failure
- Automatically refreshes project and photo lists after successful sync

**Technical Implementation:**
- Both quick capture and capture-edit flows use fire-and-forget pattern for sync queueing
- Sync errors surface to users immediately while preserving snappy UX
- Query invalidation ensures UI reflects server state after manual sync
- E2E tests verified sync button functionality and toast messaging

### Photo Annotation Editor UI Redesign v4 (October 13, 2025)
Completed comprehensive redesign of the photo annotation editor with improved layout and bug fixes:

**UI Improvements:**
- Relocated cancel (X) and save (✓) buttons to fixed positions in top-left and top-right corners (48px)
- Expanded color palette from 8 to 12 colors (Red, Orange, Yellow, Green, Blue, Purple, Pink, Brown, Black, Gray, White, Transparent)
- Implemented scrollable color picker in left sidebar showing 4 colors at once with up/down chevron navigation arrows
- Moved size selection (S/M/L) to fixed tab buttons positioned above the bottom toolbar with clear visual indication (white background for selected size)
- Restructured bottom toolbar to be non-scrollable with all annotation tools visible (text, arrow, line, circle, pen, undo, delete)

**Critical Bug Fixes:**
- Fixed "existing is not iterable" error by adding proper null checks and Array.isArray validation before iteration
- Unified annotation save flow: both PhotoEdit.tsx (standalone) and ProjectPhotos.tsx (dialog) now use IndexedDB-based approach
- Added IndexedDBManager.savePhotoWithId() helper method to properly create photos with all required LocalPhoto fields
- Implemented server-synced photo handling: both entry points now fetch photo from server and create IndexedDB entry when editing already-synced photos
- Added comprehensive error handling with descriptive error messages and console logging for debugging

**Technical Improvements:**
- Ensured all LocalPhoto fields are populated (id, projectId, blob, thumbnailBlob, caption, annotations, serverId, createdAt, updatedAt)
- Annotation persistence confirmed working across editor sessions
- Background sync queue properly handles annotation uploads to server
- E2E tests passing with full verification of UI layout, drawing, saving, and persistence

## User Preferences
- **Communication style**: I prefer simple language and direct answers.
- **Coding style**: I prefer clean, modern, and well-documented code. Focus on readability and maintainability.
- **Workflow preferences**: I want iterative development with frequent updates and feedback loops. Prioritize core functionality first.
- **Interaction preferences**: Ask for confirmation before implementing major architectural changes or deleting significant code.
- **General working preferences**:
    - Ensure all user-facing features are intuitive and require minimal explanation.
    - Focus on performance, especially for mobile and offline use cases.
    - Adhere strictly to the Apple-inspired design principles outlined in the architecture.
    - Do not introduce unnecessary complexity; simplicity is key.
    - Provide clear explanations for any technical decisions.

## System Architecture

### UI/UX Decisions
The design philosophy is "Apple-inspired," emphasizing extreme minimalism, content-first presentation, generous white space, subtle depth, typography excellence, and consistent 8px grid spacing. The color palette includes primary iOS Blue (`#007AFF`), secondary Warm Gray (`#8E8E93`), Success Green (`#34C759`), Warning Orange (`#FF9500`), and background colors Pure White (`#FFFFFF`) and Light Gray (`#F2F2F7`). Interaction design features fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete functionality. Components use rounded buttons (8px), subtle card shadows, clean forms with floating labels, and a tab bar navigation with SF Symbols-inspired icons. Branding features the FieldSnaps logo prominently across key screens.

### Technical Implementations
FieldSnaps is built as an offline-first PWA, leveraging Service Workers for intelligent caching and IndexedDB for local photo storage, ensuring full functionality without internet access. Background Sync API handles queued uploads with retry logic. Performance is optimized through lazy loading (Intersection Observer API), Web Workers for non-blocking image compression, and strict URL lifecycle management. The intelligent photo system offers three compression levels (Standard 500KB, Detailed 1MB, Quick 200KB) using Canvas API, instant thumbnail generation, and aspect ratio preservation.

Camera functionality includes auto-start, instant capture workflows (Quick Capture, Capture & Edit), project-specific pre-selection, and immersive full-screen viewfinders with glassmorphic controls and a bottom navigation auto-hide. Photo sharing supports multi-photo selection, date-grouped timeline views, and public read-only share pages. Authentication is managed via Replit Auth with OpenID Connect, securing API routes, and supports biometric login (WebAuthn/FIDO2). An interactive 3-step onboarding flow guides new users, and contextual prompts support PWA installation.

### Feature Specifications
The application features a main navigation with "Camera," "Projects," and "Settings" tabs. The camera interface includes a project selection screen, full-screen viewfinder, floating capture button, quality selector, zoom levels (1x/2x/3x), and a centered camera flip button. Project organization uses a card-based layout with photo counts, search, and address buttons. Photo management provides grid and timeline views, swipe actions, batch selection, and bottom bar controls for editing, sharing, commenting, deleting, and renaming.

**Photo Annotation Editor v4** features a redesigned layout with fixed cancel (X) button in top-left and save (✓) button in top-right (both 48px). The left sidebar contains a scrollable color picker displaying 12 colors (Red, Orange, Yellow, Green, Blue, Purple, Pink, Brown, Black, Gray, White, Transparent) with 4 visible at once and up/down chevron arrows for navigation. Size selection (S/M/L for 5px/8px/12px strokes) is implemented as fixed tab buttons positioned at bottom-20 above the toolbar, with white background indicating the selected size. The bottom toolbar is non-scrollable and contains all annotation tools (text, arrow, line, circle, pen) plus undo and delete buttons. Text annotations support scaling and rotation.

Upload status is indicated by subtle progress, smart notifications, and clear visual hierarchy. Robust error handling ensures graceful degradation, clear messages, and automatic retry logic. Auto-naming of photos uses the format `[ProjectName]_[Date]_[Time]`.

Key features include an interactive map view displaying geocoded projects, a 30-day trash bin for soft-deleted items with restore and permanent delete options, and bulk photo move functionality.

### System Design Choices
The build philosophy centers on simplicity and invisible interface design, allowing users to focus on their work. The PWA infrastructure relies on a Service Worker with hourly updates and offline caching. The storage strategy utilizes IndexedDB for Blob storage of photos, intelligent quota management, and automatic thumbnail cleanup.

## External Dependencies

### Frontend
- **React**: JavaScript library for building user interfaces.
- **TypeScript**: Superset of JavaScript that adds static typing.
- **Vite**: Next-generation frontend tooling.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: Component library for React.
- **Wouter**: A tiny routing library for React.
- **TanStack Query**: Asynchronous state management library.

### Backend
- **Express.js**: Web application framework for Node.js.
- **PostgreSQL**: Relational database (Replit built-in).
- **Drizzle ORM**: TypeScript ORM for relational databases.

### PWA Technologies
- **Service Worker API**: For offline caching and background processes.
- **Web Manifest**: For PWA installation and metadata.
- **IndexedDB**: Client-side storage for structured data and Blobs.
- **Background Sync API**: For deferring network operations until connectivity is restored.

### Authentication
- **Replit Auth**: For user authentication.
- **SimpleWebAuthn**: Library for WebAuthn/FIDO2 biometric authentication.

### Third-Party APIs
- **Google Geocoding API**: For converting addresses to latitude/longitude coordinates.