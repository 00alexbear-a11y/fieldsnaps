# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals to provide robust offline photo and video documentation. Its primary goal is to enhance project efficiency, minimize disputes, and streamline organization through features like instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product, offering full offline functionality and touch optimization to address critical needs in construction documentation. A major new feature in development is automatic time tracking with geofencing.

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
The design adopts an Apple-inspired aesthetic with minimalism, clear typography, and an 8px grid. It features fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, and a tab bar with SF Symbols-inspired icons. The camera interface is optimized for one-handed use with frosted glass effects. A CSS-first, mobile-first responsive design ensures adaptability, including a split-screen before/after comparison and a redesigned landing page. Unified navigation and a single header with contextual actions provide a consistent user experience. All sticky/fixed UI elements respect iOS safe area standards using Tailwind utilities and `env(safe-area-inset-*)` CSS variables.

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

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. A Service Worker handles hourly updates and offline caching. Storage uses IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system includes queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Global error notifications are managed via TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations focus on compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system. Critical edge cases like phone dying while clocked in, overlapping geofences, and low GPS accuracy are handled. Data collection for geofencing is privacy-compliant, with defined data retention and user rights.

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