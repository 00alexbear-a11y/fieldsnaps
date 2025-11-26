# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, designed to provide robust offline photo and video documentation. Its primary goal is to enhance project efficiency, minimize disputes, and streamline organization through instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product with full offline functionality and touch optimization, addressing critical needs in construction documentation. Key capabilities include automatic time tracking with geofencing and comprehensive timecard export (CSV, Basic PDF, Detailed PDF).

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
The design adopts an Apple-inspired aesthetic with minimalism, clear typography, and an 8px grid, featuring fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, and a tab bar with SF Symbols-inspired icons. The camera interface is optimized for one-handed use with frosted glass effects and haptic feedback. A CSS-first, mobile-first responsive design ensures adaptability, including split-screen comparison and a redesigned landing page. Unified navigation and iOS safe area support are implemented globally using `env(safe-area-inset-*)` CSS variables. An Apple-style red notification badge on the To-Do tab icon indicates unread task assignments.

Apple-style polish enhancements include:
- Clean form design: Task creation dialog uses descriptive placeholders instead of boxed labels while maintaining accessibility through aria-labels and required attributes
- Auto-applying date picker: FullScreenCalendar closes immediately upon date selection, eliminating extra confirmation taps
- Context-aware camera: Camera UI adapts based on entry point—when accessed from task creation (mode=task-photo), hides irrelevant modes (VIDEO, TO-DO) to streamline photo attachment workflow

### Technical Implementations
FieldSnaps is an offline-first PWA utilizing Service Workers, IndexedDB, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera supports instant capture, video, and real-time annotation, with session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor provides a native-like iOS experience, with Capgo for OTA updates. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing.

Key features include:
- A bottom navigation bar, comprehensive camera interface, and in-camera session preview.
- A To-Do system with photo attachments and card-based project organization.
- Photo management with various views, swipe actions, batch selection, and a Photo Annotation Editor.
- An interactive map view, 30-day trash bin, bulk photo move, and fullscreen photo viewer.
- User-scoped project preferences and an activity feed for multi-user accountability.
- A timezone-safe time tracking system with Clock In/Out functionality and timesheets.
- "Snap & Speak" camera mode for rapid task creation via photo and voice recognition.
- Profile photo upload and editing with public ACL storage in Replit Object Storage, integrated into the first-login onboarding flow.
- Automatic time tracking with geofencing using TransistorSoft Capacitor Background Geolocation for clock-in/out notifications based on job site arrival/departure. Geofences are automatically created and managed with a fixed 500ft radius.
- **Location Privacy Transparency**: Dedicated screen accessible from Settings explaining what location data is tracked and why it benefits workers (accurate pay, personal time records, mileage tracking). Workers can pause/resume automatic time tracking via toggle control. This addresses Apple App Store requirements by framing location tracking as a worker benefit, not just employer monitoring.
- Google Places Autocomplete streamlines address entry for project creation and editing, automatically parsing city, state, and zip code.
- Real-time geofence visualization on the admin Locations page displays project geofences as blue circles with project markers on Google Maps.
- PDF Timecard Export System offers weekly timesheets in three formats: CSV, Basic PDF Timecard (Apple-style design), and Detailed PDF Report (including GPS coordinates, entry method, travel time breakdown, and edit audit trail). Travel time is auto-calculated based on movement telemetry between different projects.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. A Service Worker handles hourly updates and offline caching. Storage uses IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system includes queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Global error notifications are managed via TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations focus on compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system. Critical edge cases like phone dying while clocked in, overlapping geofences, and low GPS accuracy are handled. A comprehensive iOS-optimized keyboard management solution uses `MobileDialog` and `useKeyboardManager` to auto-scroll inputs into view and prevent UI overlap.

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

### Capacitor Plugins
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

## Recent Changes

### iOS App Store Deployment Preparation (November 19, 2025)

**Phase 1-3: Privacy, Geofencing, and License Validation - COMPLETED**
- Enhanced Info.plist privacy descriptions with plain language emphasizing worker benefits
- Created Location Privacy transparency screen accessible from Settings
- Added user controls to pause/resume automatic time tracking
- Implemented iOS 20-geofence limit with proximity-based rotation (25-mile radius)
- Safe wrapper for getGeofences() prevents runtime crashes when native layer fails
- License validation with numeric error codes and user-friendly error messages
- Graceful degradation on plugin failures with consistent array handling

**Phase 4-7: Documentation and Testing Checklists - COMPLETED**
Created comprehensive documentation:
- `docs/ios-app-store-review-strategy.md` - App Store submission strategy with worker-benefit narrative
- `docs/demo-video-script.md` - Demo video script for App Store preview
- `docs/transistorsoft-license-setup.md` - TransistorSoft license purchase and setup guide
- `docs/ios-native-testing-checklist.md` - Native device testing requirements (gestures, safe areas, haptics, geofencing)
- `docs/app-store-submission-checklist.md` - Final pre-submission validation covering code, assets, compliance, testing

**Phase 8: TransistorSoft License Configuration - COMPLETED (November 20, 2025)**
- Purchased TransistorSoft Capacitor Background Geolocation Premium License ($389)
- License key successfully configured for Android (iOS does not require license configuration):
  - Android: Added `com.transistorsoft.locationmanager.license` meta-data to `android/app/src/main/AndroidManifest.xml`
  - iOS: No license configuration needed - TransistorSoft plugin works on iOS without license key setup
- License: `bf49c0f499931f7b15eb7618f825ff2af39ee5037e24050168766fc72d3203bd` (for app identifier: `com.fieldsnaps.app`)

**Production-Ready Status**: All code and documentation for iOS deployment is architect-approved and ready for native device testing on physical iPhones. TransistorSoft license is configured and ready for validation. Next step requires physical iOS device for runtime validation.

**Key Implementation Details:**
- `client/src/lib/geofencing.ts` - Safe geofence management with 20-limit enforcement
- `client/src/pages/LocationPrivacy.tsx` - Worker-benefit transparency messaging
- `shared/schema.ts` - Added autoTrackingEnabled boolean field to users table
- `ios/App/App/Info.plist` - Comprehensive privacy descriptions for App Store compliance
- `android/app/src/main/AndroidManifest.xml` - TransistorSoft license key configuration

### Bug Fixes and UX Improvements (November 25-26, 2025)

**Photo Attachment Bug Fix - COMPLETED**
- Fixed critical bug in task photo attachment flow: Camera's `captureAndEdit` function was returning local IndexedDB photo ID instead of waiting for server sync
- Both quick capture and captureAndEdit now use `uploadPhotoAndWait` in attach mode to ensure server photo ID is available before navigating to ToDos
- Graceful fallback: If upload fails (offline), user sees toast message and can attach photo later from gallery

**Sidebar UX Overhaul - COMPLETED (November 26, 2025)**
- Removed gray overlay from mobile sidebar for cleaner, less intrusive navigation
- Added subtle right border (`border-r border-border shadow-lg`) for visual definition
- Replaced hamburger menu icon with directional arrows (ChevronRight when closed, ChevronLeft when open)
- Made FieldSnaps logo clickable as part of sidebar toggle for larger tap target

**To-Do List Density Improvements - COMPLETED (November 26, 2025)**
- Reduced task card padding (`px-3 py-2` instead of `p-3`) for more compact display
- Smaller text sizes (`text-sm`) and icons (`w-3.5 h-3.5`) for better density
- Tighter section spacing (`space-y-1.5`) to fit more tasks on screen
- Smaller section headers (`text-xs`) with reduced gaps

**Safari Form Improvements - COMPLETED (November 26, 2025)**
- Added `autocomplete="off"`, `autoCorrect="off"`, `spellCheck="false"` to New Task form inputs
- Suppresses Safari's autofill accessory bar for cleaner keyboard experience
- MobileDialog already handles keyboard-safe scrolling via visualViewport management