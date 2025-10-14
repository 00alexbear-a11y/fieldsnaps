# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired, premium Progressive Web App (PWA) designed for construction professionals to capture and document job sites. Its core purpose is to provide an extremely simple, offline-reliable, and effortless photo documentation experience, focusing on instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app aims for complete offline functionality, touch optimization for work gloves, and reliability in challenging environments, ultimately enhancing efficiency and reducing disputes in construction projects.

## Recent Changes

### Bug Fixes and Pinch-to-Zoom (October 14, 2025)
Completed 7 critical bug fixes and feature implementations:

**1. Bottom Navigation Safe Area Padding** ✓
- Added `pb-safe` class to bottom navigation inner div
- Lifts navigation above iPhone curved screen edges
- Prevents gesture bar overlap on iOS devices

**2. Video Recording Save Functionality** ✓
- Implemented full video recording save to IndexedDB
- Videos saved with auto-caption format: `[ProjectName]_VIDEO_[Date]_[Time]`
- Uses same sync infrastructure as photos (IndexedDB + background sync)
- Videos stored as LocalPhoto objects with video/webm blob

**3. Zoom Controls During Video Recording** ✓
- Hid zoom buttons during active video recording
- Prevents camera stream interruption when recording
- Zoom controls remain available in photo mode and before/after recording

**4. Storage Display Clarification** ✓
- Changed "Storage" to "Offline Storage" with clarifying subtitle
- Label now says "Local Photos" instead of "Photos"
- Makes clear it only shows photos captured on this device

**5. Project Settings Gear Icon Removal** ✓
- Completely removed gear icon and settings dialog
- All related code cleaned up with no orphaned references

**6. Camera Permission Re-prompts Fix** ✓
- Modified zoom switching to use `applyConstraints()` first
- Only restarts camera stream if constraints fail (iOS physical lens switch)
- Significantly reduces permission re-prompts on modern browsers

**7. Pinch-to-Zoom Within Each Lens** ✓
- Implemented continuous pinch-to-zoom gestures for fine control
- Lens ranges: 0.5x (0.5-0.99x), 1x (1.0-1.99x), 2x (2.0-2.99x), 3x (3.0-3.99x)
- Two-finger pinch gestures detected and mapped to zoom values
- Visual feedback: zoom indicator (e.g., "1.5x") shown during pinch
- Discrete lens buttons (0.5x, 1x, 2x, 3x) switch physical lenses
- Smooth zoom application using `applyConstraints()` without stream restart

**Technical Implementation:**
- All changes reviewed and approved by architect
- No LSP errors or breaking changes
- Proper error handling throughout

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

The Photo Annotation Editor v4 features a redesigned layout with fixed cancel (X) button in top-left and save (✓) button in top-right. The left sidebar contains a scrollable color picker displaying 12 colors with 4 visible at once and up/down chevron arrows for navigation. Size selection (S/M/L for 5px/8px/12px strokes) is implemented as fixed tab buttons positioned above the bottom toolbar, with white background indicating the selected size. The bottom toolbar is non-scrollable and contains all annotation tools (text, arrow, line, circle, pen) plus undo and delete buttons. Text annotations support scaling and rotation.

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