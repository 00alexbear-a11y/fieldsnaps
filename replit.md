# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals. Its core purpose is to provide robust offline photo and video documentation, aiming to boost efficiency and minimize disputes. Key features include instant media capture, smart compression, auto-timestamping, and efficient project organization. The project emphasizes full offline functionality and touch optimization, with aspirations to evolve into a commercial SaaS product.

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
The design adheres to an "Apple-inspired" philosophy, characterized by minimalism, content-first presentation, generous white space, and typography, using an 8px grid and a specific color palette. Interaction design emphasizes fluid 0.3s easing animations, haptic feedback, natural gesture navigation (including swipe-to-dismiss and swipe-to-delete), and progressive disclosure. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons. Key UI elements such as the camera interface and zoom controls utilize frosted glass effects, precise sizing for one-handed operation, and careful safe-area handling for notch devices.

### Technical Implementations
FieldSnaps is an offline-first PWA utilizing Service Workers for caching, IndexedDB for local storage, and the Background Sync API for background uploads. Performance is optimized with lazy loading and Web Workers for image compression via the Canvas API. Photos and videos are stored in Replit Object Storage using presigned URLs. The camera module supports auto-start, instant capture, and video recording with real-time annotation capabilities. PDF export supports flexible grid layouts.

The application implements an Instagram/Google Photos-inspired session-based photo management system for optimal mobile performance. Photos captured during a camera session remain in IndexedDB throughout the entire session (even after upload), providing instant thumbnail access and smooth navigation between camera and edit modes. Each session is tracked via a unique sessionId, and photos are marked with sessionActive flags. The system uses uploadedAt timestamps to track upload completion while keeping photos locally cached. Intelligent quota management automatically monitors storage usage and triggers cleanup of old uploaded photos when reaching 80% capacity, targeting down to 70% usage. Session cleanup occurs only when leaving the camera (not during edit transitions), deleting uploaded photos and clearing session flags while preserving pending/failed uploads for retry. Real-time UI indicators show upload progress with green checkmarks for completed uploads and pulsing yellow clocks for pending/syncing states, displayed both in the camera header status badge and on individual photo thumbnails. The application features a multi-platform subscription system supporting Stripe (web), Apple In-App Purchase (iOS), and Google Play Billing (Android), managed by a unified validation service. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor integration provides a native-feeling iOS experience with native helpers for Haptic Feedback, Native Share, Status Bar Control, Network Detection, Clipboard, Splash Screen, and Keyboard Management. JWT tokens are stored in Keychain for native iOS authentication.

### Feature Specifications
The application includes a bottom navigation, a comprehensive camera interface, and a To-Do system with photo attachments. The camera interface features session-based mode persistence (Photo/Video/Edit) using sessionStorage - the selected mode is preserved throughout the session when navigating to/from edit, with smooth 300ms fade-in transitions when returning, and resets to Photo mode on fresh page loads. Project organization is card-based with photo counts and search. Photo management offers grid/timeline views, swipe actions, and batch selection. The Photo Annotation Editor provides tools for text, arrows, lines, circles, pens, and a tape measure. Photos are auto-named `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view, a 30-day trash bin, and bulk photo move functionality. The fullscreen photo viewer includes optimized bottom controls, an edit menu, responsive labels, and accessibility considerations, with smooth, GPU-accelerated carousel transitions.

### System Design Choices
The build philosophy emphasizes simplicity and an invisible interface. The PWA infrastructure uses a Service Worker for hourly updates and offline caching. Storage leverages IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query and sync queue optimization, database indexing, and code-splitting for large components. The offline sync system is hardened with queue size limits, single-flight locks, exponential backoff with jitter, atomic deduplication, and upsert logic. OAuth for native apps uses the Capacitor Browser plugin with custom URL schemes. Critical performance enhancements include `crossOrigin='use-credentials'`, O(n) photo rendering with Map-based caching, `viewport-fit=cover` for iPhone X+ devices, and comprehensive CSS utilities for iOS safe-area handling (`.pt-safe`, `.pt-safe-2`, `.pt-safe-3`, `.pb-safe-*`) applied consistently across all page headers to prevent content overlap with iPhone notch. Virtualization with `@tanstack/react-virtual` is implemented for large photo collections, and global error toast notifications are managed via TanStack Query. Sync status is displayed inline within Settings and Projects headers (below logo) showing pending upload counts when items await sync; no overlay components are used to prevent notch interference.

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
- **@capacitor/core**: Core functionality and platform detection.
- **@capacitor/app**: App lifecycle management.
- **@capacitor/browser**: Opens OAuth URLs.
- **@capacitor/device**: Device information.
- **@capacitor/preferences**: Native storage.
- **@capacitor/filesystem**: Native file system access.
- **@capacitor/camera**: Native camera integration.
- **@capacitor/haptics**: Native haptic feedback.
- **@capacitor/share**: Native iOS share sheet.
- **@capacitor/status-bar**: Native status bar control.
- **@capacitor/network**: Native network detection.
- **@capacitor/clipboard**: Native clipboard operations.
- **@capacitor/keyboard**: Native keyboard management.
- **@capacitor/splash-screen**: Native splash screen control.

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion.
- **Stripe**: Web subscription management and payment processing.