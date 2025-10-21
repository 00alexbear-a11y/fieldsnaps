# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals. Its core purpose is to provide offline-reliable photo and video documentation, enhancing efficiency and reducing disputes through features like instant media capture, smart compression, auto-timestamping, and efficient project organization. The project aims for full offline functionality and touch optimization, with ambitions to become a commercial SaaS product and a mission-driven model donating 20% of proceeds to missionaries.

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
The design adheres to an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, typography excellence, and an 8px grid. The color palette includes iOS Blue, Warm Gray, Success Green, Warning Orange, Pure White, and Light Gray. Interaction design incorporates fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons. The branding features the FieldSnaps logo.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers for caching and IndexedDB for local storage, with the Background Sync API managing uploads. Performance is optimized via lazy loading and Web Workers for image compression. The intelligent photo system offers three compression levels via the Canvas API, instant thumbnail generation, and preserves native aspect ratios. Photos and videos are stored in Replit Object Storage using presigned URLs. Camera functionality includes auto-start, instant capture workflows, and video recording with real-time annotation. PDF export supports flexible grid layouts with customizable detail options.

The application features a multi-platform subscription system supporting Stripe (web), Apple In-App Purchase (iOS), and Google Play Billing (Android) at a unified $19.99/month. A unified validation service (`server/subscriptionValidation.ts`) handles subscriptions from all sources. Authentication uses Replit Auth with OpenID Connect and biometric login.

**Native iOS Integration (October 2025)**: Comprehensive Capacitor plugin integration transforms web app into truly native-feeling iOS experience. Native helpers (`client/src/lib/native*.ts`) provide platform detection with graceful web fallbacks. Features include:
- **Haptic Feedback**: Success/error/light haptics in Camera (photo/video capture), PhotoGestureViewer (long-press), and clipboard operations
- **Native Share**: Converts photos to filesystem temp files, shares via iOS share sheet with AirDrop support, respects cancellation without side effects, auto-cleans up cache files
- **Status Bar Control**: Hides during camera use for immersive full-screen, shows with theme-aware styling on exit, auto-restores on unmount
- **Network Detection**: Capacitor Network plugin with WiFi/cellular type detection, replaces navigator.onLine
- **Clipboard**: Native clipboard with haptic feedback in ProjectPhotos, Projects, Settings (share links, invite links)
- **Splash Screen**: Auto-hides 300ms after app initialization
- **Keyboard Management**: useKeyboardManager hook with auto-scroll, listener cleanup (infrastructure ready for forms)

### Feature Specifications
The application includes a bottom navigation, a camera interface with a three-zone layout, and a To-Do system for team task management with photo attachments. Project organization is card-based with photo counts and search. Photo management offers grid/timeline views, swipe actions, and batch selection. The Photo Annotation Editor features a centered visual island layout with tools for text, arrows, lines, circles, pens, and a tape measure. Photo auto-naming follows `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view, a 30-day trash bin, and bulk photo move functionality.

**Photo Viewer Controls (October 2025)**: Production-ready fullscreen photo viewer with optimized bottom controls for mobile and accessibility:
- **Layout**: 3-column grid (`grid-cols-[1fr_auto_1fr]`) ensures true centering on all screen sizes (≥320px) without overlap
- **Simplified Controls**: Back button (bottom-left), centered action group (Annotate, Edit menu, Share, Delete)
- **Edit Menu**: DropdownMenu consolidates Tag, Rename, Comment, and "Use as Icon" actions; displays comment count badge when comments exist
- **Responsive Labels**: Icon-only on small screens (`hidden sm:inline`), icon+label on sm+ for space efficiency
- **Accessibility**: All buttons have aria-labels, Prev/Next navigation arrows labeled, comments panel uses `inert` when hidden to prevent focus trapping
- **Safe-area Support**: Bottom padding uses `max(0.75rem, env(safe-area-inset-bottom))` for iOS home indicator compatibility

### System Design Choices
The build philosophy prioritizes simplicity and an invisible interface. The PWA infrastructure uses a Service Worker for hourly updates and offline caching. Storage utilizes IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query and sync queue optimization, and database indexing.

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

### Capacitor Plugins (Native iOS Integration - October 2025)
- **@capacitor/core**: Core functionality and platform detection.
- **@capacitor/app**: App lifecycle management.
- **@capacitor/device**: Device information.
- **@capacitor/preferences**: Native storage for app preferences.
- **@capacitor/filesystem**: Native file system access for photo sharing.
- **@capacitor/camera**: Native camera integration.
- **@capacitor/haptics**: Native haptic feedback (impact, notification, selection).
- **@capacitor/share**: Native iOS share sheet with AirDrop support.
- **@capacitor/status-bar**: Native status bar control (hide/show, theme-aware).
- **@capacitor/network**: Native network detection (WiFi, cellular, offline).
- **@capacitor/clipboard**: Native clipboard operations.
- **@capacitor/keyboard**: Native keyboard management (show/hide, listeners).
- **@capacitor/splash-screen**: Native splash screen control.
- **@capacitor/action-sheet**: Native iOS action sheets (planned).
- **@capacitor/toast**: Native iOS toast notifications (planned).
- **@capacitor/dialog**: Native iOS dialogs/alerts (planned).
- **@capacitor/local-notifications**: Native push notifications (planned).
- **@capacitor/geolocation**: Native GPS coordinates for photos (planned).

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion.
- **Stripe**: Web subscription management and payment processing.
- **Apple StoreKit**: iOS In-App Purchase for app subscriptions (planned).
- **Google Play Billing Library**: Android In-App Purchase for app subscriptions (planned).