# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals. Its primary purpose is to provide effortless, offline-reliable photo documentation to enhance efficiency and reduce disputes in construction projects. Key capabilities include instant photo capture, smart compression, auto-timestamping, and efficient project organization. The project aims for full offline functionality and touch optimization for challenging environments, aspiring to become a commercial SaaS product.

### Recent Updates (October 15, 2025)
- **PhotoEdit Navigation Fix**: Corrected return-to-camera behavior after editing
  - Changed from `window.history.back()` to explicit `setLocation(/camera?projectId=X)` navigation
  - Fixes issue where cancel/save in PhotoEdit would return to project selection instead of camera
  - Camera component now properly receives projectId parameter and maintains viewfinder state
  - Applied to handleSave, handleCancel, and handleDelete functions in PhotoEdit
  - Graceful fallback to `/camera` if projectId unavailable
- **Video Recording Canvas Fix**: Eliminated "canvas not ready" errors during video recording
  - Annotation canvas now always rendered in DOM (hidden when not recording) to ensure refs exist
  - Prevents recording failures caused by missing canvas element references
  - Maintains same visual behavior with conditional visibility instead of conditional rendering
- **Real-Time Video Annotation**: Draw temporary highlights during video recording
  - Touch-based drawing overlay appears during video recording
  - Annotations follow finger precisely with coordinate scaling (CSS pixels → canvas resolution)
  - Temporary highlights clear 50ms after finger lift (captured in ~1-2 frames)
  - Highlights baked into saved video via canvas compositing at 30fps
  - Brand blue (#169DF5) stroke with scaled line width for consistent visibility
  - Composite canvas system: annotation overlay + video stream → MediaRecorder
- **Session Photo Persistence with Race Condition Guard**: localStorage-based session restoration with async safety
  - Session photos now persist across Camera remounts when returning from PhotoEdit
  - Implemented currentProjectRef guard to prevent cross-project photo leakage during async restore
  - Photos only restore if project hasn't changed mid-async operation
  - Session clears properly on project switch and on non-photo navigation exit
  - captureAndEdit workflow now adds photos to session before navigating to edit mode
- **Thumbnail Layout**: Vertical strip on left side with exact sizing (confirmed working as designed)
  - Positioned at left-4 with vertical centering (top-1/2 -translate-y-1/2)
  - max-h-[344px] for exactly 4 photos (4×80px thumbnails + 3×8px gaps)
  - CSS mask fade effect at top/bottom (0% → 15% → 85% → 100%)
  - Vertical scrolling with flex-col and overflow-y-auto
- **Arrow Tool Redesign**: Improved arrow annotation visual quality
  - Arrowhead now extends past shaft line instead of sitting on top
  - Shaft stops at arrowhead base, triangle extends to tip for unified arrow shape
  - Better proportions: headLength = max(strokeWidth * 2.5, 30px), headWidth = strokeWidth * 1.2
  - Matches professional arrow design with black outline and colored fill

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
The design adheres to an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, subtle depth, and typography excellence, all based on an 8px grid. The color palette includes iOS Blue, Warm Gray, Success Green, Warning Orange, Pure White, and Light Gray. Interaction design incorporates fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons. The branding prominently features the FieldSnaps logo. The bottom navigation includes "Map," "Projects," "Inbox," and "Camera" tabs, with Settings accessible from the Projects page header.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers for caching and IndexedDB for local photo storage. The Background Sync API manages queued uploads. Performance is optimized through lazy loading, Web Workers for image compression, and strict URL lifecycle management. The intelligent photo system offers three compression levels via the Canvas API, instant thumbnail generation, and aspect ratio preservation. Photos are stored in Replit Object Storage, using presigned URLs for upload and server-side ACL policies. IndexedDB maintains local blob caches for offline access, with a sync manager coordinating uploads. Camera functionality includes auto-start, instant capture workflows (Quick Capture, Capture & Edit), project-specific pre-selection, and full-screen viewfinders. Photo sharing supports multi-photo selection, date-grouped timeline views, and public read-only share pages. Authentication uses Replit Auth with OpenID Connect and supports biometric login. An interactive 3-step onboarding and contextual PWA installation prompts guide new users. The application is built with robust error resilience.

### Feature Specifications
The application features a bottom navigation with "Map," "Projects," "Inbox," and "Camera" tabs. The camera interface includes project selection, a full-screen viewfinder, a floating capture button, quality selector, zoom levels, and a camera flip button. Project organization is card-based with photo counts, search, and address buttons. Photo management offers grid and timeline views, swipe actions, batch selection, and controls for editing, sharing, commenting, deleting, and renaming. The Photo Annotation Editor has a redesigned layout with fixed cancel/save buttons, a scrollable color picker, size selection (S/M/L) as fixed tabs, and a non-scrollable bottom toolbar for annotation tools (text, arrow, line, circle, pen), undo, and delete. Text annotations support scaling and rotation. Photo auto-naming follows the format `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view for geocoded projects, a 30-day trash bin for soft-deleted items, and bulk photo move functionality.

### System Design Choices
The build philosophy emphasizes simplicity and invisible interface design. The PWA infrastructure relies on a Service Worker for hourly updates and offline caching. The storage strategy uses IndexedDB for Blob storage, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query optimization, sync queue optimization (batch processing, smart prioritization, exponential backoff), and database indexing.

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
- **Replit Object Storage**: Cloud object storage for persistent photo storage.

### PWA Technologies
- **Service Worker API**: For offline caching and background processes.
- **Web Manifest**: For PWA installation and metadata.
- **IndexedDB**: Client-side storage for structured data and Blobs.
- **Background Sync API**: For deferring network operations.

### Authentication
- **Replit Auth**: For user authentication.
- **SimpleWebAuthn**: Library for WebAuthn/FIDO2 biometric authentication.

### Third-Party APIs
- **Google Geocoding API**: For converting addresses to latitude/longitude coordinates.