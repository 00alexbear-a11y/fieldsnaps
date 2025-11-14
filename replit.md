# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals to provide robust offline photo and video documentation. Its primary goal is to enhance project efficiency, minimize disputes, and streamline organization through features like instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product, offering full offline functionality and touch optimization to address critical needs in construction documentation. Major features include automatic time tracking with geofencing and comprehensive timecard export (CSV, Basic PDF, Detailed PDF).

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
The design adopts an Apple-inspired aesthetic with minimalism, clear typography, and an 8px grid. It features fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, and a tab bar with SF Symbols-inspired icons. The camera interface is optimized for one-handed use with frosted glass effects and includes Apple-style medium haptic feedback when the shutter button is pressed, providing satisfying tactile confirmation of photo capture. A CSS-first, mobile-first responsive design ensures adaptability, including a split-screen before/after comparison and a redesigned landing page. Unified navigation and a single header with contextual actions provide a consistent user experience. All sticky/fixed UI elements respect iOS safe area standards using Tailwind utilities and `env(safe-area-inset-*)` CSS variables.

**iOS Safe Area Support**: Global CSS utilities in `index.css` provide automatic safe-area padding using `env(safe-area-inset-*)` to prevent UI overlap with iPhone notch/status bar. All side sheets (Sheet component with `side="left"` or `side="right"`), top sheets, and bottom drawers automatically apply appropriate safe-area classes (`safe-area-inset-top`, `safe-area-inset-bottom`) to ensure content remains visible below the status bar and above the home indicator. The viewport meta tag includes `viewport-fit=cover` across all entry points (web, iOS, Android) to enable safe-area environment variables. This solution has zero impact on non-iOS devices where safe-area values default to 0px.

**Notification System**: An Apple-style red notification badge appears on the To-Do tab icon (not a separate bell icon) showing the count of unread task assignments. The badge uses iOS red gradient (#FF3B30 to #FF2D23), displays "9+" for counts above 9, and only appears when there are unread notifications. The notification query is authentication-gated to prevent API errors during app initialization, refreshing every 60 seconds.

### Technical Implementations
FieldSnaps is an offline-first PWA, utilizing Service Workers, IndexedDB, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera supports instant capture, video, and real-time annotation, with Instagram/Google Photos-inspired session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor provides a native-like iOS experience, with Capgo for OTA updates. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing.

Key features include:
- A bottom navigation bar, comprehensive camera interface, and in-camera session preview.
- A To-Do system with photo attachments and card-based project organization.
- Photo management with various views, swipe actions, batch selection, and a Photo Annotation Editor.
- An interactive map view, 30-day trash bin, bulk photo move, and fullscreen photo viewer.
- User-scoped project preferences and an activity feed for multi-user accountability.
- A timezone-safe time tracking system with Clock In/Out functionality and timesheets, including state validation.
- "Snap & Speak" camera mode for rapid task creation via photo and voice recognition, using `TodoSessionContext` for client-side staging and transactional batch saving.
- **Profile photo upload and editing**: First-login profile setup dialog prompts users to add a profile photo (via camera/gallery) and complete their name. Photos are stored in Replit Object Storage with public ACL. Users can later edit their profile via Settings. The dialog is non-dismissible for first-time users (prevents bypass via backdrop/Escape) and gates onboarding flow. Supports both web and native platforms with proper FormData handling.
- **Automatic time tracking with geofencing**: Utilizes TransistorSoft Capacitor Background Geolocation for automatic clock-in/out notifications based on job site arrival/departure, aiming for 5-10% battery drain over 8 hours. This includes database schema extensions for geofences, location logs, user permissions, and time entry edits, alongside enhancements to existing `clockEntries` for GPS verification. Role-based access control is implemented for various features. This feature requires specific iOS PrivacyInfo.xcprivacy and Info.plist configurations, and AndroidManifest.xml updates for foreground services and background location permissions, adhering to App Store and Google Play Console declarations.
- **Google Places Autocomplete for addresses**: Project creation and editing uses Google Places Autocomplete API to streamline address entry. When users select a suggested address (via mouse click or keyboard selection), the system automatically parses and stores city, state, and zip code. Manual address entry is also supported with backend geocoding. The projects table includes dedicated city, state, and zipCode fields for structured data storage. A MutationObserver ensures the Google-rendered `.pac-container` dropdown has proper z-index (99999) and pointer-events (auto) to overcome Radix Dialog overlay blocking, enabling both mouse and keyboard interactions. An `onKeyDown` handler prevents Enter key from prematurely submitting the form when selecting autocomplete suggestions, keeping the dialog open for users to complete other fields.
- **Real-time geofence visualization on map**: The admin Locations page displays project geofences as blue circles (500ft radius) overlaid on the Google Maps view, with project markers at geofence centers. When a project address is updated, the system automatically updates associated geofence coordinates and the map refreshes within 60 seconds to show the new location. Worker location dots and geofence markers are maintained independently for reliable visualization.
- **PDF Timecard Export System**: Users can export weekly timesheets in three formats via the Timesheets page:
  - **CSV (Spreadsheet)**: Universal format for payroll systems and spreadsheet applications
  - **Basic PDF Timecard**: Clean weekly timecard with Apple-style design (Helvetica, 11pt minimum font per Apple HIG), daily hours grid, project names, overtime breakdown, and signature lines for employee/supervisor - ideal for payroll and filing
  - **Detailed PDF Report**: Includes all Basic PDF content plus forensic-level details: GPS coordinates (text format) for each entry, entry method (Manual/GPS/Geofence), travel time breakdown with movement detection, and complete edit audit trail (who, when, original/new values) - designed for dispute resolution, client billing, and compliance
  - **Travel Time Auto-Calculation**: Conservative algorithm requires different projects AND confirmed movement telemetry (isMoving flag from location logs) to calculate travel time. Only counts actual movement time from location tracking to prevent false positives from lunch breaks or off-clock time. Returns zero travel when location tracking is disabled or unavailable.
  - **Strategic Decision**: QuickBooks integration was intentionally NOT implemented. Instead, FieldSnaps uses universal file formats (CSV, PDF) that work with any payroll/accounting system, avoiding vendor lock-in and complex API maintenance.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. A Service Worker handles hourly updates and offline caching. Storage uses IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system includes queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Global error notifications are managed via TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations focus on compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system. Critical edge cases like phone dying while clocked in, overlapping geofences, and low GPS accuracy are handled. Data collection for geofencing is privacy-compliant, with defined data retention and user rights.

**Unified Mobile Keyboard System**: A comprehensive iOS-optimized keyboard management solution using `MobileDialog` component and `useKeyboardManager` hook. The system uses visualViewport API (primary) with Capacitor keyboard events (fallback) to detect keyboard height and auto-scroll inputs into view. MobileDialog provides top-aligned dialogs with scrollable bodies, sticky footers, and dynamic max-height adjustment. All 8 major form dialogs (CreateProject, EditProject, Tag Edit, Team, PDF Settings, TimeReview main/edit, ToDos, ProfileSetup) plus at-risk components (VoiceCaptureSheet, PhotoAnnotationEditor text/measurement dialogs) use this pattern. Race condition handling uses `isProgrammaticClose` ref to distinguish user-initiated closes (backdrop/escape) from programmatic closes (Done/Cancel buttons), ensuring callbacks invoke exactly once. The system includes optional close button support (`showCloseButton` and `closeLabel` props) and proper state cleanup on cancel.

**Critical Bug Fixes**:
- **TimeReviewDialog clock-out hang**: Fixed issue where "Review Your Day" dialog became stuck with disabled buttons after successful clock-out. The bug was caused by awaiting `invalidateQueries` in `ClockStatusCard`'s mutation `onSuccess` callback before closing the dialog. Solution: Close dialog immediately after successful API response, then run cache invalidation asynchronously in background without blocking UI updates. This ensures responsive UI behavior even under network latency.

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
- **PostgreSQL**: Relational database
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

### Capacitor Plugins (Key ones for core functionality and geofencing)
- **@capacitor/core**: Core functionality
- **@capacitor/camera**: Native camera integration
- **@capacitor/haptics**: Native haptic feedback
- **@transistorsoft/capacitor-background-geolocation**: Battery-optimized background location tracking and geofencing
- **@transistorsoft/capacitor-background-fetch**: Background task scheduling for location sync
- **@capacitor-community/speech-recognition**: Native speech recognition

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion
- **Google Maps API**: Map views and location display (for admin dashboard)
- **Stripe**: Web subscription management and payment processing