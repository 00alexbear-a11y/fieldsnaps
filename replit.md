# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, providing robust offline photo and video documentation. Its core purpose is to enhance efficiency, minimize disputes, and streamline project organization through features like instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product with full offline functionality and touch optimization.

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
The design adheres to an Apple-inspired philosophy, characterized by minimalism, generous white space, and clear typography, built on an 8px grid with a specific color palette. Interactions feature fluid 0.3s easing animations, haptic feedback, and natural gesture navigation (e.g., swipe-to-dismiss). Components include rounded buttons, subtle card shadows, clean forms, and a tab bar using SF Symbols-inspired icons. Key elements like the camera interface incorporate frosted glass effects and are optimized for one-handed operation and safe-area handling. A CSS-first, mobile-first responsive design system ensures adaptability across all screen sizes. Recent updates include a split-screen before/after comparison in the hero section and a complete landing page redesign focused on conversion with a minimalist, Apple-inspired aesthetic.

### Technical Implementations
FieldSnaps is an offline-first PWA utilizing Service Workers for caching, IndexedDB for local storage, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera module supports auto-start, instant capture, video recording, and real-time annotation. PDF export supports flexible grid layouts. The application employs an Instagram/Google Photos-inspired session-based photo management system, intelligent quota management, and WiFi-only upload controls. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor integration provides a native-like iOS experience with native helpers for various device functionalities. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing.

### Feature Specifications
The application includes a bottom navigation bar, a comprehensive camera interface with session-based mode persistence, an in-camera session preview gallery, and a To-Do system with photo attachments. Project organization is card-based with photo counts and search. Photo management offers grid/timeline views, swipe actions, and batch selection. A Photo Annotation Editor provides tools for text, arrows, lines, and a tape measure. Photos are auto-named. Additional features include an interactive map view, a 30-day trash bin, bulk photo move functionality, and a fullscreen photo viewer with optimized controls and GPU-accelerated carousel transitions. The camera interface employs specific layer structures for smooth transitions, and gesture isolation ensures separate handling for the session preview and main camera container.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. The PWA infrastructure uses a Service Worker for hourly updates and offline caching. Storage leverages IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database indexing, query optimization, code-splitting, and virtualization with `@tanstack/react-virtual`. The offline sync system features queue size limits, exponential backoff, and atomic deduplication with serverId-based data loss prevention. Failed sync items remain in queue indefinitely for manual resolution instead of auto-deletion. Manual deletion operations (swipe, batch, and "Delete All") safely check for serverId presence before removing local photo blobs, ensuring only never-uploaded photos are deleted. Orphan cleanup removes photos lacking both queue entries and serverIds. OAuth for native apps uses the Capacitor Browser plugin. Critical performance enhancements include `crossOrigin='use-credentials'`, O(n) photo rendering with Map-based caching, `viewport-fit=cover`, and comprehensive CSS utilities for iOS safe-area handling. Global error toast notifications are managed via TanStack Query.

**Production Readiness (Phase 2 - Completed November 2025)**: React Error Boundaries provide graceful fallback UI with Apple-inspired design, retry/home navigation, and dev-only diagnostics. Empty states implemented across all pages (Projects, Photos, ToDos, Trash) with consistent iconography and helpful messaging. Haptic feedback integrated throughout the app using `@capacitor/haptics` with success/warning/error patterns for major interactions. Security headers middleware implemented with CSP configured to allow Google Maps (maps.googleapis.com, gstatic.com), X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Strict-Transport-Security (production), referrer policy, and worker-src for PWA/Maps workers. Rate limiting on all auth endpoints (10 requests/15 minutes per IP) with automatic development mode bypass and proper IPv6 support.

**User-Scoped Project Preferences (Phase 3.1-3.3 - Completed November 2025)**: Individual user favorites and visit tracking implemented via `projectFavorites` and `projectVisits` junction tables with composite unique constraints. Each user maintains their own favorite projects list and recent visit history, supporting personalized navigation and project discovery. Storage methods provide user-specific queries (`getUserFavoriteProjectIds`, `getUserRecentProjectIds`), while API routes enforce company-level access control combined with individual preferences. This architecture enables per-user accountability while maintaining team collaboration visibility.

**Navigation & UI Polish (Phase 5 - Completed November 2025)**: Bottom navigation reduced to 4 essential items (Projects, To-Do, Locations, Camera) with Activity moved to sidebar-only access. Camera repositioned to rightmost position for thumb-friendly tapping. Bottom nav z-index increased to z-100 for reliable touch events across all pages. FieldSnaps logo replaced hamburger menu as universal sidebar trigger in global header (z-50), paired with NotificationPanel bell icon. Duplicate icons removed (Settings from Projects page, single NotificationPanel instance). Settings page redesigned with Apple iOS-style compact layout featuring 8 grouped sections (Account, Appearance, Camera, Data & Storage, Team, PDF Export, Billing, About) using Card components with list-style rows, reducing file size from 1818 to ~1662 lines while preserving all functionality. Sidebar configured with `collapsible="icon"` mode for toggleable navigation, hidden on camera/edit pages per established visibility rules.

**Page-Specific Sidebars (Phase 6 - Completed November 2025)**: Implemented context-aware sidebars for Photos, Projects, and Camera pages following consistent structure with SidebarProvider pattern. PhotosSidebar provides smart views (All Photos, Today, This Week, This Month), filter options (by project, uploader, session, date range), and sort controls (newest/oldest, A-Z/Z-A) integrated with ProjectPhotos page. ProjectsSidebar offers smart views (All Projects, Recent, Favorites), sort options (Name A-Z/Z-A, Most Photos, Last Activity, Date Created), and Show Completed toggle integrated with Projects page via SidebarProvider. CameraSettingsSidebar uses Sheet-based slide-out panel with photo quality presets (Quick/Standard/Detailed), grid overlay toggle, PDF mode toggle, and auto-save preferences, all persisted to localStorage. Settings accessible via dedicated button in camera UI top bar. All sidebars feature consistent component structure (groups, menu buttons, badges) and comprehensive data-testid coverage for testing.

### Backend Performance Optimizations
Backend optimizations include compression (Gzip/Brotli) for API payloads, field filtering via query parameters, and robust upload resilience with timeouts and per-user rate limiting. Database performance is enhanced with indexes and in-memory response caching with user-scoped keys and cache invalidation. CORS middleware is scoped to `/api/*` routes, supporting Capacitor WebView origins, localhost, and Replit domains. An intelligent 3-tier upload system is implemented: traditional multipart for small files (<5MB), direct-to-cloud presigned URLs for medium files (5-20MB), and chunked upload with retry logic for large files (>20MB). Real-time metrics track upload performance for all methods.

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