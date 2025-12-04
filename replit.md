# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, providing robust offline photo and video documentation. Its purpose is to enhance project efficiency, minimize disputes, and streamline organization through instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product with full offline functionality and touch optimization, addressing critical needs in construction documentation. Key capabilities include automatic time tracking with geofencing and comprehensive timecard export (CSV, Basic PDF, Detailed PDF).

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
The design adopts an Apple-inspired aesthetic with minimalism, clear typography, and an 8px grid, featuring fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, and a tab bar with SF Symbols-inspired icons. The camera interface is optimized for one-handed use with frosted glass effects and haptic feedback. A CSS-first, mobile-first responsive design ensures adaptability, including split-screen comparison and a redesigned landing page. Unified navigation and iOS safe area support are implemented globally. An Apple-style red notification badge on the To-Do tab icon indicates unread task assignments. Clean form design, auto-applying date pickers, and context-aware camera UIs enhance usability.

### Technical Implementations
FieldSnaps is an offline-first PWA utilizing Service Workers, IndexedDB, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera supports instant capture, video, and real-time annotation, with session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor provides a native-like iOS experience, with Capgo for OTA updates. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing. Features include a bottom navigation bar, comprehensive camera, To-Do system with photo attachments, various photo management views, an interactive map, and user-scoped project preferences. A timezone-safe time tracking system with Clock In/Out functionality and timesheets is included. "Snap & Speak" camera mode allows rapid task creation via photo and voice recognition. Automatic time tracking uses geofencing via TransistorSoft Capacitor Background Geolocation. Location privacy is transparently explained to users, and Google Places Autocomplete streamlines address entry. Real-time geofence visualization is available on the admin Locations page. A PDF Timecard Export System offers weekly timesheets in CSV, Basic PDF, and Detailed PDF formats.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. A Service Worker handles hourly updates and offline caching. Storage uses IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system includes queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Global error notifications are managed via TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations focus on compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system. Critical edge cases like phone dying while clocked in, overlapping geofences, and low GPS accuracy are handled. An iOS-optimized keyboard management solution auto-scrolls inputs into view.

### Time Tracking Safety Features (December 2024)
- **Server-side auto-close**: Scheduled job runs every 5 minutes to detect stale sessions
  - Respects per-company `staleSessionTimeoutMinutes` (default 30 min)
  - Respects per-company `maxShiftHours` (default 12 hours)
  - Creates auto clock-out entries with reason (max_shift or stale_heartbeat)
  - Marks original clock-in with `autoClosedAt` and `autoCloseReason`
- **Heartbeat tracking**: `lastHeartbeat` field on clock entries tracks device connectivity
- **Admin visibility**: Admin timesheets show "Last seen" for active workers and "Auto-closed" badge for auto-closed entries
- **Background tracking**: stopOnTerminate=false ensures tracking continues when app is closed

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
- **Supabase Auth**: Primary authentication provider with Google OAuth, Apple Sign-In, and email/password
  - PKCE flow for secure mobile OAuth
  - SecureStorage for native iOS token persistence
  - Auto-refresh and offline session caching
  - Deep link handling for OAuth callbacks (com.fieldsnaps.app://auth/callback)
- **Replit Auth**: Legacy authentication (dual auth support during transition)
- **SimpleWebAuthn**: WebAuthn/FIDO2 biometric authentication

### Supabase Auth Configuration

#### Current Status (December 2024)
- **Google OAuth**: Fully configured and tested
- **Apple Sign-In**: Fully configured and tested (web + iOS native)
- **Session Persistence**: Working - tokens survive page refresh

#### Provider Configuration
**Google OAuth** (Supabase → Authentication → Providers → Google):
- Client ID and Secret from Google Cloud Console
- Callback: `https://pbfuwfzccdmpkmhncyjg.supabase.co/auth/v1/callback`

**Apple Sign-In** (Supabase → Authentication → Providers → Apple):
- Service ID: `com.fieldsnaps.signin`
- Team ID: `9739WWYHQ6`
- Key ID: `7AB24X9GC4`
- Private Key: Stored in Supabase (from .p8 file)
- Callback: `https://pbfuwfzccdmpkmhncyjg.supabase.co/auth/v1/callback`

**Apple Developer Configuration**:
- App ID: `com.fieldsnaps.app`
- Service ID: `com.fieldsnaps.signin` (for web authentication)
- Domain: `pbfuwfzccdmpkmhncyjg.supabase.co`
- Return URL: `https://pbfuwfzccdmpkmhncyjg.supabase.co/auth/v1/callback`

#### URL Configuration (Supabase → Authentication → URL Configuration)
- Site URL: Production domain when available
- Redirect URLs:
  - `com.fieldsnaps.app://auth/callback` (native iOS deep link)
  - Production domain callback URL when available

#### Important Notes
- **Apple Name Handling**: Apple only sends user's name on FIRST login. Backend captures and stores it in database.
- **Secret Key Rotation**: Apple OAuth web secrets must be rotated every 6 months. Set calendar reminder.
- **GoTrue Version**: Requires v2.139.2+ for Apple auth (check Project Settings → Infrastructure)

#### Dual Auth Support
- Backend validates both Supabase JWT and Replit tokens simultaneously
- Existing Replit users automatically linked to Supabase accounts via email match
- Database: `supabase_user_id` column added to users table for linking

#### Key Files
- `client/src/lib/supabase.ts` - Supabase client with SecureStorage for native
- `client/src/lib/supabaseAuth.ts` - Auth functions (signIn, signOut, session management)
- `client/src/hooks/useAuth.ts` - React hook with Supabase session state
- `client/src/pages/AuthCallback.tsx` - OAuth callback handler
- `client/src/pages/Login.tsx` - Login page with Google and Apple buttons
- `server/supabaseAuth.ts` - Backend JWT validation with JWKS

#### Universal Links
- AASA endpoint at `/.well-known/apple-app-site-association`
- Needs Team ID + production domain configuration for native app deep links

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