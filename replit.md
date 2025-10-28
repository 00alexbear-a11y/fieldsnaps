# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals. Its primary purpose is to provide offline-reliable photo and video documentation, aiming to enhance efficiency and reduce disputes through instant media capture, smart compression, auto-timestamping, and efficient project organization. The project targets full offline functionality and touch optimization, with ambitions to become a commercial SaaS product.

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
The design adheres to an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, and typography. It uses an 8px grid and a specific color palette (iOS Blue, Warm Gray, Success Green, Warning Orange, Pure White, Light Gray). Interaction design includes fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers for caching and IndexedDB for local storage, with the Background Sync API for uploads. Performance is optimized via lazy loading and Web Workers for image compression (three levels via Canvas API). Photos and videos are stored in Replit Object Storage using presigned URLs. Camera functionality includes auto-start, instant capture, and video recording with real-time annotation. PDF export supports flexible grid layouts.

The application features a multi-platform subscription system supporting Stripe (web), Apple In-App Purchase (iOS), and Google Play Billing (Android) at a unified $19.99/month, handled by a unified validation service. Authentication uses Replit Auth with OpenID Connect and biometric login. Capacitor plugin integration provides a native-feeling iOS experience, with native helpers for Haptic Feedback, Native Share, Status Bar Control, Network Detection, Clipboard, Splash Screen, and Keyboard Management. Authentication in native iOS uses JWT tokens stored in the Keychain.

### Feature Specifications
The application includes a bottom navigation, a camera interface, and a To-Do system with photo attachments. Project organization is card-based with photo counts and search. Photo management offers grid/timeline views, swipe actions, and batch selection. The Photo Annotation Editor features tools for text, arrows, lines, circles, pens, and a tape measure. Photos are auto-named `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view, a 30-day trash bin, and bulk photo move functionality. The fullscreen photo viewer includes optimized bottom controls, an edit menu, responsive labels, and accessibility considerations.

### System Design Choices
The build philosophy prioritizes simplicity and an invisible interface. The PWA infrastructure uses a Service Worker for hourly updates and offline caching. Storage utilizes IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query and sync queue optimization, database indexing, and code-splitting for large components (e.g., lazy loading ProjectPhotos, Camera, Settings, ToDos pages). The offline sync system is hardened with queue size limits, single-flight locks, exponential backoff with jitter, atomic deduplication, and upsert logic. OAuth for native apps uses Capacitor Browser plugin with custom URL schemes and backend redirect URI validation. Performance optimizations include `crossOrigin='use-credentials'` for authenticated images, O(n) photo rendering using Map-based caching, iPhone X+ display support with `viewport-fit=cover`, and CSS utilities for iOS safe-area handling. Virtualization with `@tanstack/react-virtual` is implemented in `ProjectPhotos.tsx` for large photo collections. Global error toast notifications are implemented using TanStack Query's `QueryCache` and `MutationCache`.

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
- **@capacitor/app**: App lifecycle management and deep link listening.
- **@capacitor/browser**: Opens OAuth URLs in Safari.
- **@capacitor/device**: Device information.
- **@capacitor/preferences**: Native storage for app preferences.
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