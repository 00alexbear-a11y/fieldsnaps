# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, focused on effortless, offline-reliable photo documentation. It aims to enhance efficiency and reduce disputes in construction projects through instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app targets full offline functionality and touch optimization for challenging environments, aspiring to be a commercial SaaS product.

### Recent Updates (October 15, 2025)
- **Camera Tag Workflow Improvements**: Enhanced tag selector UX and auto-selection behavior
  - Limited tag selector to max 5 visible tags (max-h-[220px]) with vertical scroll for overflow
  - Auto-select "General" tag on camera open (once per project using hasAutoSelectedGeneralRef)
  - Selected tags persist after photo capture for rapid multi-photo tagging (removed setSelectedTags([]) from capture functions)
  - Users can manually clear tags and they stay cleared (no re-auto-selection)
  - Fixed color picker in tag edit dialog - added portal container (position="popper", z-50) so dropdown renders above dialog
  - Fixed sync queue cleanup - permanently failed photos (max retries exceeded) now removed from queue via idb.removeFromSyncQueue()
- **Tag Management in Settings**: Complete CRUD functionality for photo tags
  - Added "Photo Tags" section to Settings page with tag list display
  - Implemented create, edit, and delete operations for tags
  - Dialog interface for tag creation/editing with name input and color selection (red, orange, yellow, blue, gray)
  - API routes: PUT /api/tags/:id for updating tags, integrated with existing POST and DELETE routes
  - Real-time UI updates via React Query cache invalidation after mutations
- **Camera UI Polish**: Final camera interface refinements
  - Removed background box around tags - cleaner, more minimalist appearance with individual tag pills
  - Fixed zoom magnifiers overlapping with capture buttons by moving from bottom-36 to bottom-44
- **Camera UI Reorganization**: Complete camera interface restructure for better usability
  - Session-only thumbnails: Now shows only photos from current session (not all project photos), clears on camera close
  - Thumbnails repositioned to very bottom (bottom-2) with most recent first
  - Tag selector converted to vertical layout on right side, centered vertically  
  - Mode selector (Photo/Video) moved to top-24 for better accessibility
  - Fixed invalid z-index classes (z-15 → z-30/z-40) that prevented element visibility
- **Camera Tag Loading**: Fixed tags not loading on camera screen by adding x-skip-auth header to tags API call
- **Color Picker UX**: Fixed chevron direction - now shows ChevronUp when collapsed (indicating upward expansion)
- **Project Cards**: Removed share button from project cards for cleaner interface
- **Selection Toolbar**: Made responsive with flex-wrap to prevent button overflow on small screens
- **Batch Tag Feature**: Implemented multi-photo batch tagging - Tag button in selection toolbar opens dialog to apply tags to multiple photos simultaneously

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
The design follows an "Apple-inspired" philosophy: extreme minimalism, content-first presentation, generous white space, subtle depth, and typography excellence, utilizing an 8px grid. The color palette includes iOS Blue, Warm Gray, Success Green, Warning Orange, and background colors Pure White and Light Gray. Interaction design features fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar with SF Symbols-inspired icons. Branding prominently features the FieldSnaps logo. The bottom navigation includes "Map," "Projects," "Inbox," and "Camera" tabs, with Settings moved to the Projects page header.

### Technical Implementations
FieldSnaps is an offline-first PWA, utilizing Service Workers for caching and IndexedDB for local photo storage. The Background Sync API handles queued uploads. Performance optimizations include lazy loading, Web Workers for image compression, and strict URL lifecycle management. The intelligent photo system offers three compression levels using Canvas API, instant thumbnail generation, and aspect ratio preservation. Photos are stored in Replit Object Storage, with upload via presigned URLs and server-side ACL policies. IndexedDB maintains local blob caches for offline access. The sync manager coordinates uploads from IndexedDB to object storage. Camera functionality includes auto-start, instant capture workflows (Quick Capture, Capture & Edit), project-specific pre-selection, and full-screen viewfinders. Photo sharing supports multi-photo selection, date-grouped timeline views, and public read-only share pages. Authentication is managed via Replit Auth with OpenID Connect and supports biometric login. An interactive 3-step onboarding guides new users, and contextual prompts support PWA installation. The application incorporates robust error resilience.

### Feature Specifications
The application features a bottom navigation with "Map," "Projects," "Inbox," and "Camera" tabs. The camera interface includes project selection, a full-screen viewfinder, a floating capture button, quality selector, zoom levels, and a camera flip button. Project organization uses a card-based layout with photo counts, search, and address buttons. Photo management provides grid and timeline views, swipe actions, batch selection, and controls for editing, sharing, commenting, deleting, and renaming. The Photo Annotation Editor v4 has a redesigned layout with fixed cancel/save buttons, a scrollable color picker, size selection (S/M/L) as fixed tabs, and a non-scrollable bottom toolbar for annotation tools (text, arrow, line, circle, pen), undo, and delete. Text annotations support scaling and rotation. Auto-naming of photos follows `[ProjectName]_[Date]_[Time]`. Other features include an interactive map view for geocoded projects, a 30-day trash bin for soft-deleted items, and bulk photo move functionality.

### System Design Choices
The build philosophy emphasizes simplicity and invisible interface design. The PWA infrastructure relies on a Service Worker with hourly updates and offline caching. The storage strategy uses IndexedDB for Blob storage, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query optimization, sync queue optimization (batch processing, smart prioritization, exponential backoff), and database indexing.

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
- **Replit Object Storage**: Cloud object storage for persistent photo storage with ACL-based access control.

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