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

**Clock In/Out Time Tracking (Phase 8A - Completed Nov 2025):** A timezone-safe time tracking system with ClockStatusCard on Projects page for clock in/out and breaks. Server stores UTC timestamps; client handles ALL timezone processing via three-stage pipeline (buildShifts, buildBreaks, assignToDays) with clamping logic for cross-week/overnight shifts. Timesheets page shows weekly hours with daily breakdown, week navigation, and CSV export with timezone headers. Supports overnight shifts (11pm→7am), cross-week shifts, in-progress shifts, and handles duplicate entries. API expands query by ±24 hours to capture boundary events.

**Unified Navigation (Completed Nov 2025):** Single context-aware AppSidebar replaces duplicate sidebars across pages. Logo restored in global header acts as sidebar trigger. Sidebar shows route-specific sections: Projects Smart Views/Sort/Options on /projects, ToDos Smart Lists on /todos, global navigation (Activity/Settings/Help) on all pages. Filter and sort state managed via URL query parameters with browser history support. Both AppSidebar and page components listen to popstate (browser back/forward) and custom filterChange events to maintain synchronization. Route detection uses window.location.pathname to ignore query params, enabling contextual sections to remain visible when filters add query strings.

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