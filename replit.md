# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals to provide robust offline photo and video documentation. Its primary goal is to enhance efficiency, minimize disputes, and streamline project organization through features like instant media capture, smart compression, and auto-timestamping. The project aims to evolve into a commercial SaaS product offering full offline functionality and touch optimization, targeting market potential by addressing critical needs in construction documentation.

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
The design embraces an Apple-inspired aesthetic with minimalism, ample white space, clear typography, and an 8px grid. It features fluid 0.3s easing animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, clean forms, and a tab bar with SF Symbols-inspired icons. The camera interface incorporates frosted glass effects and is optimized for one-handed use and safe-area handling. A CSS-first, mobile-first responsive design ensures adaptability across all screen sizes. Recent enhancements include a split-screen before/after comparison and a redesigned landing page focused on conversion.

### Technical Implementations
FieldSnaps operates as an offline-first PWA, leveraging Service Workers for caching, IndexedDB for local storage, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera module supports auto-start, instant capture, video recording, and real-time annotation. The application employs an Instagram/Google Photos-inspired session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor integration provides a native-like iOS experience with native helpers. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing. Key features include a bottom navigation bar, a comprehensive camera interface, an in-camera session preview gallery, and a To-Do system with photo attachments. Project organization is card-based with photo counts and search. Photo management offers grid/timeline views, swipe actions, and batch selection. A Photo Annotation Editor provides tools for text, arrows, lines, and a tape measure. Photos are auto-named. Additional features include an interactive map view, a 30-day trash bin, bulk photo move, and a fullscreen photo viewer with GPU-accelerated carousel transitions. The camera interface uses specific layer structures for smooth transitions and gesture isolation. User-scoped project preferences (favorites, visits) are implemented. An activity feed provides multi-user accountability with attribution for uploads, project creation, and tasks. 

**Clock In/Out Time Tracking (Phase 8A - Completed Nov 2025):** A timezone-safe time tracking system with ClockStatusCard for clock in/out and breaks. Server stores UTC timestamps; client handles ALL timezone processing via three-stage pipeline (buildShifts, buildBreaks, assignToDays) with clamping logic for cross-week/overnight shifts. Timesheets page shows weekly hours with daily breakdown, week navigation, and CSV export with timezone headers. Supports overnight shifts (11pm→7am), cross-week shifts, in-progress shifts, and handles duplicate entries. API expands query by ±24 hours to capture boundary events.

**Time Tracking Bug Fixes (Completed Nov 2025):**
- Fixed query parameter handling in `queryClient.ts`: TanStack Query now properly handles both multi-segment query keys (e.g., `['/api/projects', projectId]` → `/api/projects/${projectId}`) AND object query parameters (e.g., `['/api/endpoint', { param: value }]` → `/api/endpoint?param=value`)
- Fixed race condition in clock-out flow: Made mutation's `onSuccess` callback async and ensured cache invalidation completes before closing the Time Review dialog, ensuring UI updates correctly
- Time Review dialog now properly fetches and displays today's clock entries with correct date range parameters
- Clock status calculation uses `timestamp` (actual event time) for ordering to support legitimate retroactive/backfill edits during timesheet audits
- **Implemented state validation**: Added `validateClockEntryState()` function that replays the state machine before creating or editing clock entries, preventing invalid state transitions (e.g., clocking out when not clocked in, editing timestamp to create impossible sequence). Validation provides clear error messages for corrective action.

**Unified Navigation (Completed Nov 2025):** Single context-aware AppSidebar replaces duplicate sidebars across pages. Header displays separate hamburger menu icon (sidebar trigger) and FieldSnaps logo for clear visual separation. Sidebar shows route-specific sections: Projects Smart Views/Sort/Options on /projects, ToDos Smart Lists on /todos, global navigation (Activity/Settings/Help) on all pages. Filter and sort state managed via URL query parameters with browser history support. Both AppSidebar and page components listen to popstate (browser back/forward) and custom filterChange events to maintain synchronization. Route detection uses window.location.pathname to ignore query params, enabling contextual sections to remain visible when filters add query strings.

**Single Header with Contextual Actions (Completed Nov 2025):** Header refactored to show route-specific action buttons alongside global navigation. Structure: [Menu Icon] [Logo] [New Button (only on /projects)] ... [Notifications]. CreateProjectDialog component extracted from Projects page and integrated into App.tsx header. New button visibility uses pathname check (`pathname === '/projects'`) to remain visible even when query params are present (e.g., `/projects?view=recent`). Removed duplicate action bar from Projects page. UpgradeModal centralized in App.tsx for reuse across components.

**Dedicated Time Tracking Tab (Completed Nov 2025):** Time tracking moved from Projects page to dedicated /time route with 5th bottom nav tab (Clock icon). ClockStatusCard removed from Projects page to reduce clutter. New Time.tsx page provides optional access to clock in/out features and links to Timesheets. Makes time tracking non-intrusive for solo crews who don't need it. Bottom navigation expanded from 4 to 5 tabs: Projects, To-Do, Locations, Time, Camera.

**UI Refinements (Completed Nov 2025):** Fixed todo list item styling where swipe action backgrounds (orange/red) were bleeding through card corners - added rounded-lg to all swipe background layers to match Card component corners. Fixed sidebar z-index (increased to z-[200]) to properly overlay bottom navigation on both mobile and desktop, preventing layering issues where sidebar appeared behind nav buttons.

**Camera-to-ToDo Voice Capture ("Snap & Speak") (Completed Nov 2025):** Fourth camera mode enables rapid task creation via photo + voice workflow. In TODO mode, users capture photo → voice sheet auto-opens with native speech recognition (@capacitor-community/speech-recognition on iOS/Android, Web Speech API fallback on desktop) → speak task description → add to session. Session-based batch creation allows multiple tasks before save. Review screen provides editing, team assignment via GET /api/projects/:id/members, and photo annotation with markup tools. Batch save uploads photos to object storage sequentially (fail-fast with rollback), creates todos via atomic POST /api/todo-sessions transaction. Architecture features: TodoSessionContext for client-side staging, ref-based blob URL tracking for memory safety (cleanup on unmount/success), robust error handling with try/catch on all speech recognition paths (start/stop/cancel), transactional batch save with photo rollback on failure, cache invalidation for /api/todos and project queries. UX includes ToDoInstructionScreen on first use (localStorage check), blue capture button in TODO mode, review button with item count badge, haptic feedback throughout flow (Medium on capture, Light on actions, Heavy on success), and actionable error messages for network failures. Security: backend validates project ownership, photo-project matching, assignee verification with removedAt checks. All overlay lifecycle paths (voice sheet close, annotation close, session review close) properly stop speech recognition and cleanup state to prevent memory leaks.

### System Design Choices
The architecture emphasizes simplicity and an invisible interface. The PWA uses a Service Worker for hourly updates and offline caching. Storage utilizes IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database indexing, query optimization, code-splitting, and virtualization with `@tanstack/react-virtual`. The offline sync system features queue size limits, exponential backoff, and atomic deduplication. Failed sync items persist indefinitely for manual resolution. Manual deletion checks for `serverId` presence before removing local blobs. Global error toast notifications are managed via TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations include compression, field filtering, upload resilience with timeouts, per-user rate limiting, and database indexing. An intelligent 3-tier upload system handles various file sizes.

## External Dependencies

### Frontend
- **React**: UI library
- **TypeScript**: Typed JavaScript
- **Vite**: Frontend tooling
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: React component library
- **Wouter**: Routing library
- **TanStack Query**: Asynchronous state management

### Backend
- **Express.js**: Node.js web framework
- **PostgreSQL**: Relational database (Replit built-in)
- **Drizzle ORM**: TypeScript ORM
- **Replit Object Storage**: Cloud object storage

### PWA Technologies
- **Service Worker API**: Offline caching and background processes
- **Web Manifest**: PWA installation and metadata
- **IndexedDB**: Client-side structured data storage
- **Background Sync API**: Deferring network operations

### Authentication
- **Replit Auth**: User authentication
- **SimpleWebAuthn**: WebAuthn/FIDO2 biometric authentication

### Native Platform & OTA Updates
- **Capacitor 6**: Native wrapper for iOS/Android
- **Capgo**: Encrypted over-the-air (OTA) updates

### Capacitor Plugins
- **@capacitor/core**: Core functionality and platform detection
- **@capacitor/app**: App lifecycle management
- **@capacitor/browser**: Opens OAuth URLs
- **@capacitor/device**: Device information
- **@capacitor/preferences**: Native storage
- **@capacitor/filesystem**: Native file system access
- **@capacitor/camera**: Native camera integration
- **@capacitor/haptics**: Native haptic feedback
- **@capacitor/share**: Native iOS share sheet
- **@capacitor/status-bar**: Native status bar control
- **@capacitor/network**: Native network detection
- **@capacitor/clipboard**: Native clipboard operations
- **@capacitor/keyboard**: Native keyboard management
- **@capacitor/splash-screen**: Native splash screen control

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion
- **Stripe**: Web subscription management and payment processing