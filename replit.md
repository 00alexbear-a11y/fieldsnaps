# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals. Its core purpose is to provide robust offline photo and video documentation, enhancing project efficiency, minimizing disputes, and streamlining organization through instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product, offering full offline functionality, touch optimization, automatic time tracking with geofencing, and comprehensive timecard export capabilities.

## Recent Changes (January 2026)

### Phase 4 Native App API URL Fix (Critical - Jan 2026)
- **Root Cause**: On native Capacitor platforms, relative URLs like `/api/auth/user` resolve to `capacitor://localhost/api/auth/user` which serves the bundled `index.html` (200 OK) - NOT the actual backend. This caused auth to fail silently.
- **Solution**: Modified `getApiUrl()` in `client/src/lib/apiUrl.ts` to use `VITE_API_URL` on native platforms. Since we use Bearer token auth (not cookies), cross-origin requests work fine.
- **Technical Note**: `VITE_API_URL=https://fieldsnaps.replit.app` is **required for native builds**. Web uses relative URLs (same origin).
- **Content-Type Validation**: Added content-type check in AuthContext to catch HTML responses with clear error messages.

### Phase 2 Native App Hotfix (Historical - Superseded by Phase 4)
- **Offline Indicator**: Made notification more compact (pill style) with auto-dismiss after 3 seconds.
- **Header Fix**: Removed `backdrop-blur` from app header due to iOS WKWebView issues. Now uses solid `bg-background`.
- **Haptic Feedback**: Added haptics to sync events - success/error vibrations on sync completion.
- **Keep-Awake**: Skipped - incompatible with Capacitor 7.4.4.

### Phase 3 Native Performance Optimization
- **Platform Detection Polling Removed**: The `usePlatform.ts` hook was polling 100x every 100ms, each console.log call going through Capacitor bridge causing 10-14s startup delays. Fixed by using immediate detection (Capacitor.isNativePlatform() is reliable).
- **Auth Race Condition Fixed**: Added `isSupabaseAuthenticated` check to App.tsx to prevent redirect loops during OAuth callback when session exists but user data is still fetching.
- **Console Logging Optimized**: Added conditional `debugLog()` wrapper in syncManager.ts that skips logging on native platforms. Reduced verbose AuthContext logs. Native console.log calls are expensive as they cross the Capacitor JS-native bridge.
- **Performance Rule**: On native platforms, minimize console.log calls - each one crosses the Capacitor bridge and blocks the main thread.

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
The design adopts an Apple-inspired aesthetic, featuring minimalism, clear typography, an 8px grid, fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, a tab bar with SF Symbols-inspired icons, and a camera interface optimized for one-handed use with frosted glass effects. The design is CSS-first, mobile-first, and responsive, supporting split-screen comparison, unified navigation, and iOS safe areas. Usability is enhanced with Apple-style notification badges, clean form designs, auto-applying date pickers, and context-aware camera UIs.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers, IndexedDB, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera supports instant capture, video, real-time annotation, session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Supabase Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor provides a native-like iOS experience, with Capgo for OTA updates. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing. Key features include a bottom navigation bar, comprehensive camera, a To-Do system with photo attachments, various photo management views, an interactive map, user-scoped project preferences, a timezone-safe time tracking system with Clock In/Out and timesheets, and a "Snap & Speak" camera mode for rapid task creation. Automatic time tracking utilizes geofencing via TransistorSoft Capacitor Background Geolocation, with Google Places Autocomplete for address entry.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. Service Workers manage hourly updates and offline caching. IndexedDB is used for Blob storage, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system incorporates queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Global error notifications are handled by TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations focus on compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system. Critical edge cases like device battery failure while clocked in, overlapping geofences, and low GPS accuracy are addressed. Time tracking includes server-side auto-close for stale sessions, heartbeat tracking, and admin visibility of auto-closed entries. iOS-specific issues like WKWebView `position: fixed` and keyboard management are mitigated with targeted solutions.

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
- **Supabase Auth**: Primary authentication provider (Google OAuth, Apple Sign-In, email/password)
- **@capgo/capacitor-social-login**: For native iOS Google/Apple SDKs authentication
- **SimpleWebAuthn**: WebAuthn/FIDO2 biometric authentication

### Native Platform & OTA Updates
- **Capacitor 6**: Native wrapper for iOS/Android
- **Capgo**: Encrypted over-the-air (OTA) updates

### Capacitor Plugins
- **@capacitor/camera**: Native camera integration
- **@capacitor/haptics**: Native haptic feedback
- **@capacitor/keyboard**: Keyboard visibility events for iOS native
- **capacitor-plugin-safe-area**: Real device safe area insets for notches/home indicators
- **@transistorsoft/capacitor-background-geolocation**: Battery-optimized background location tracking and geofencing
- **@transistorsoft/capacitor-background-fetch**: Background task scheduling for location sync
- **@capacitor-community/speech-recognition**: Native speech recognition

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion
- **Google Maps API**: Map views and location display
- **Stripe**: Web subscription management and payment processing