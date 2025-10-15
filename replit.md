# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, focused on effortless, offline-reliable photo documentation. It aims to enhance efficiency and reduce disputes in construction projects through instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app targets full offline functionality and touch optimization for challenging environments, aspiring to be a commercial SaaS product.

### Recent Updates (October 15, 2025)
- **Arrow Tool Redesign**: Improved arrow annotation visual quality
  - Arrowhead now extends past shaft line instead of sitting on top
  - Shaft stops at arrowhead base, triangle extends to tip for unified arrow shape
  - Better proportions: headLength = max(strokeWidth * 2.5, 30px), headWidth = strokeWidth * 1.2
  - Matches professional arrow design with black outline and colored fill
- **Session Photo Persistence Fix**: Photos now persist correctly when returning from edit mode
  - Updated cleanup logic to preserve session photos for both /photo/ and /photo-edit routes
  - Session photos only clear when fully exiting camera or switching projects
  - Fixed issue where temp preview feed reset after closing/saving in edit mode
- **Edit Mode Trash Button Fix**: Corrected trash button behavior in photo annotation editor
  - Trash button now deletes entire photo and returns to camera (previous behavior: deleted annotations)
  - Provides quick discard workflow for unwanted photos during editing
  - Consistent with user expectation for "delete photo" action
- **Tag Indicators on Camera Thumbnails**: Enhanced instant visual feedback for tagged photos
  - Tags now visible immediately on camera preview thumbnails via pendingTagIds
  - Colored vertical bars on left side of thumbnails (matching project view)
  - Shows up to 2 tag colors with +N badge if more tags exist
  - Consistent design across camera and project photo views
- **Color Picker Position Refinement**: Final positioning adjustment in edit mode
  - Color picker moved to bottom-20 right-4 (aligned with S/M/L stroke size tabs)
  - Positioned above trash icon for clear visual hierarchy
  - Improved right-side alignment for better thumb reach on mobile
- **Camera Capture Menu Redesign**: New 4-button horizontal layout for improved workflow
  - Back button (ArrowLeft icon) - exits camera, disabled during recording
  - Video mode button (Video icon) - instant recording start/stop toggle
  - Normal camera button (Camera icon) - quick photo capture, larger size for primary action
  - Edit mode button (PenLine icon) - capture and immediately edit
  - All capture buttons disabled during video recording to prevent interruptions
- **Color Picker Alignment Enhancement**: Improved positioning and scroll area
  - Scroll area now spans from left edge of color swatches to right screen edge
  - Full-width container (left-0 right-0) with pl-20 left padding for proper scroll coverage
  - Toggle button aligned at exact same height as S/M/L stroke size tabs (bottom-20)
  - Enhanced touch/scroll target for better mobile UX without visual clutter
- **Camera Tag Popup Redesign**: Converted vertical tag selector to collapsible popup matching edit mode design
  - Tags now appear in collapsible popup at bottom-44 right-4 (mirroring color picker in edit mode)
  - Implemented CSS mask-image gradients for smooth fade-to-transparency at scroll edges (0% → 15% → 85% → 100%)
  - Toggle button shows chevron (up when collapsed, down when expanded) with badge showing selected tag count
  - Floating tag pills with colored backgrounds, white text, and hover effects
  - Consistent popup UX across camera tags and edit mode color picker
- **Photo Edit Mode Simplification**: Removed tag selector from annotation editor - tags only on camera screen
  - Tags are now exclusively managed from the camera screen for streamlined workflow
  - Photo annotation editor focuses purely on visual annotations (text, arrows, shapes, pen)
  - Cleaner, more focused editing experience
- **Color Picker Redesign**: Floating color dots with smooth fade effects in photo annotation mode
  - Removed background container - colors now float freely above toggle button
  - Implemented CSS mask-image gradient for smooth fade-to-transparency at scroll edges (0% → 15% → 85% → 100%)
  - Toggle button stays fixed at bottom-20 right-4 (only chevron direction changes when expanding/collapsing)
  - Larger 12x12 toggle button with 10x10 color dots for better touch interaction
  - Colors fade naturally at edges instead of harsh cutoff
- **Camera Launch Polish**: Eliminated visual stutter when opening camera
  - Added smooth opacity transition (0 to 100%) to video element
  - Video now fades in only after metadata loads and camera is ready
  - Prevents brief flash of incorrectly-scaled video during initialization
- **Simplified Tag Workflow**: Removed "General" tag - no tags selected is now the default state
  - Eliminated "General" tag from predefined tags (only Electrician, HVAC, Plumber, Framer remain)
  - Removed auto-selection logic from camera - users start with no tags selected
  - No tags selected is functionally equivalent to "General" category
  - Cleaner, more intuitive workflow
- **Projects Page Swipe Fix**: Eliminated unwanted horizontal scrolling during swipe-to-delete
  - Added swipe direction detection to distinguish horizontal swipes from vertical scrolling
  - Only horizontal swipes trigger delete action; vertical scrolling works normally
  - Set overflow-x-hidden on Projects container to prevent horizontal page scroll
- **Camera Tag Workflow Improvements**: Enhanced tag selector UX and auto-selection behavior
  - Limited tag selector to max 5 visible tags (max-h-[220px]) with vertical scroll for overflow
  - Selected tags persist after photo capture for rapid multi-photo tagging (removed setSelectedTags([]) from capture functions)
  - Users can manually clear tags and they stay cleared
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