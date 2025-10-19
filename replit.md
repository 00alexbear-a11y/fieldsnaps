# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, providing offline-reliable photo and video documentation. Its core purpose is to enhance efficiency and reduce disputes through features like instant media capture, smart compression, auto-timestamping, and efficient project organization. It aims for full offline functionality and touch optimization, aspiring to be a commercial SaaS product with a mission-driven model donating 20% of proceeds to missionaries.

## Recent Changes
**October 19, 2025**: Implemented pinch-to-zoom photo grid with smooth transitions
- Photo grid now supports gesture-based column adjustment (1-10 columns, default 5)
- Touch pinch gestures for mobile devices (two-finger pinch in/out)
- Desktop/trackpad pinch support (Ctrl+wheel)
- Smooth 0.3s cubic-bezier transitions when changing column count
- Minimal 2px gaps between photos for Apple Photos-like appearance
- Removed photo size dropdown in favor of intuitive gesture control

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
The design follows an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, subtle depth, typography excellence, and an 8px grid. The color palette includes iOS Blue, Warm Gray, Success Green, Warning Orange, Pure White, and Light Gray. Interaction design incorporates fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons. The branding features the FieldSnaps logo. The bottom navigation includes "Map," "Projects," "To-Do," and "Camera" tabs, with Settings accessible from the Projects page header.

### Technical Implementations
FieldSnaps is an offline-first PWA utilizing Service Workers for caching and IndexedDB for local storage. The Background Sync API manages uploads. Performance is optimized via lazy loading and Web Workers for image compression. The intelligent photo system offers three compression levels via the Canvas API, instant thumbnail generation, and preserves native aspect ratios from all sources. Photos and videos are stored in Replit Object Storage, using presigned URLs and server-side ACL policies. Camera functionality includes auto-start, instant capture workflows, project-specific pre-selection, full-screen viewfinders, video recording with real-time annotation, and native HTML5 playback. PDF export supports flexible grid layouts (1, 2, 3, or 4 photos per page) with customizable detail options, ensuring images retain native aspect ratios. 

**Multi-Platform Subscription System:** The app supports subscriptions from three payment sources at unified $19.99/month pricing: Stripe (web signups), Apple In-App Purchase (iOS), and Google Play Billing (Android). Database schema includes `subscriptionSource` and `platformSubscriptionId` fields to track payment platform. A unified subscription validation service (`server/subscriptionValidation.ts`) validates subscriptions from any source. Web subscribers can log into iOS/Android apps per Apple guideline 3.1.3(b) "Multiplatform Services". Apple/Google verification endpoints are secured (return 501) until proper receipt/token verification is implemented with Apple servers and Google Play Developer API.

Project completion tracking and multi-photo sharing with date-grouped timeline views and public read-only pages are supported. Authentication uses Replit Auth with OpenID Connect and biometric login.

### Feature Specifications
The application features a bottom navigation. The camera interface uses a three-zone layout with a compact header, dominant 16:9 viewfinder, and controls for quality, zoom, and auto-tagging, plus an action rail for capture and task creation. Photos are captured at full original resolution. The To-Do system enables team task management with photo attachments, viewable in "My Tasks," "Team Tasks," and "I Created" contexts, with filtering by status. Project organization is card-based with photo counts, search, address buttons, and completion marking. Photo management offers grid/timeline views, swipe actions, and batch selection. The Photo Annotation Editor features a centered visual island layout adapting to any aspect ratio, with size, color, and tool selectors (text, arrow, line, circle, pen, tape measure). Text annotations support scaling and rotation. The tape measure tool renders measurements in feet'inches". Photo auto-naming follows `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view, a 30-day trash bin, and bulk photo move functionality.

### System Design Choices
The build philosophy prioritizes simplicity and an invisible interface. The PWA infrastructure uses a Service Worker for hourly updates and offline caching. Storage uses IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query and sync queue optimization, and database indexing.

## External Dependencies

### Frontend
- **React**: UI library.
- **TypeScript**: Typed JavaScript.
- **Vite**: Frontend tooling.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: React component library.
- **Wouter**: Routing library.
- **TanStack Query**: Asynchronous state management.

### Backend
- **Express.js**: Node.js web framework.
- **PostgreSQL**: Relational database (Replit built-in).
- **Drizzle ORM**: TypeScript ORM.
- **Replit Object Storage**: Cloud object storage.

### PWA Technologies
- **Service Worker API**: Offline caching and background processes.
- **Web Manifest**: PWA installation and metadata.
- **IndexedDB**: Client-side structured data storage.
- **Background Sync API**: Deferring network operations.

### Authentication
- **Replit Auth**: User authentication.
- **SimpleWebAuthn**: WebAuthn/FIDO2 biometric authentication.

### Native Platform & OTA Updates
- **Capacitor 6**: Native wrapper for iOS/Android.
- **Capgo**: Encrypted over-the-air (OTA) updates.

### Capacitor Plugins
- **@capacitor/core**: Core functionality.
- **@capacitor/app**: App lifecycle management.
- **@capacitor/device**: Device information.
- **@capacitor/preferences**: Native storage for app preferences.
- **@capacitor/filesystem**: Native file system access.
- **@capacitor/camera**: Native camera integration (currently using `getUserMedia`).

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion.
- **Stripe**: Web subscription management and payment processing (95.6% margin after fees).
- **Apple StoreKit** (not yet implemented): iOS In-App Purchase for app subscriptions (70-85% margin).
- **Google Play Billing Library** (not yet implemented): Android In-App Purchase for app subscriptions (85% margin).

### Apple App Store & Google Play Compliance Status
**Last Updated:** October 19, 2025

**Payment System Implementation:**
- ✅ **Multi-Platform Architecture**: Database and backend support Stripe/Apple/Google subscriptions
- ✅ **Compliance Strategy**: Following Apple 3.1.3(b) "Multiplatform Services" - web subscribers can access app features, IAP offered in iOS app for new signups
- ⚠️ **Apple IAP**: Endpoint structure created but secured (returns 501) until StoreKit receipt verification implemented
- ⚠️ **Google Play Billing**: Endpoint structure created but secured (returns 501) until Play API verification implemented
- ✅ **Unified Pricing**: $19.99/month across all platforms for simplicity
- **See**: `MULTI_PLATFORM_PAYMENTS.md` and `APPLE_COMPLIANCE_REPORT.md` for complete details

**Compliant Areas:**
- ✅ Privacy Manifest (`PrivacyInfo.xcprivacy`) complete with all required APIs
- ✅ Privacy Policy comprehensive and detailed
- ✅ Capacitor 6 iOS integration configured
- ✅ Camera/Location permission descriptions documented
- ✅ Capgo OTA update system with AES-256 encryption
- ✅ Payment endpoints secured to prevent unauthorized subscription activation

**Pending Implementation:**
- ⚠️ Apple StoreKit 2 SDK integration for actual receipt verification
- ⚠️ Google Play Billing Library 7+ integration for actual purchase verification
- ⚠️ App Store Connect product configuration
- ⚠️ Google Play Console product configuration
- ⚠️ Info.plist permissions must be added during iOS build
- ⚠️ Third-party SDK privacy manifests need verification
- ⚠️ iOS 18 SDK requirement (enforced April 2025)