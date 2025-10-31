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

## Recent Changes

### iOS 26 "Liquid Glass" Camera Interface Redesign (Oct 31, 2025)
- **Top Bar Navigation**: Clean top bar with back button (left) and flip camera button (right), both using frosted glass (bg-black/30, backdrop-blur-sm) with rounded-full styling and white/80 icons. Positioned with pt-safe-2 for iPhone notch support.
- **Swipe-Down Gesture**: Native iOS-style swipe-down-to-dismiss gesture. Tracks touch starting in top 20% of screen, provides real-time visual feedback with translateY transform, dismisses camera when swiped down >100px or with velocity >0.5px/ms. Smooth 300ms spring-back animation if not dismissed.
- **Liquid Glass Zoom Controls**: Floating zoom pills (0.5×, 1×, 2×, 3×) on left side with enhanced frosted glass (bg-black/30, backdrop-blur-xl, border-white/10, shadow-2xl). Active zoom shows white background with black text. Refined spacing (gap-1.5) and padding for precision tapping.
- **Single Circular Thumbnail**: Bottom-left circular thumbnail (14×14, up from 12×12) showing most recent photo/video with enhanced border (border-white/60) and ring-1 ring-black/10 for depth. Photo count badge and tag indicator overlay on thumbnail. Tap to view/edit.
- **Mode Carousel Styling**: Enhanced text styling with tracking-tight, font-medium at 15px. Active mode uses font-semibold, scale-110, and text-white. Inactive modes use text-white/70 with smooth hover/active states. Gap increased to 6 for better touch targets.
- **Bottom Controls Background**: Gradient background (from-black/50 via-black/30 to-transparent) with backdrop-blur-md creates subtle separation from viewfinder while maintaining see-through effect. Enhanced padding (pt-5, pb-safe-6) for better visual rhythm.
- **Utility Button**: Quick actions button (tags & to-do) styled with bg-white/15, backdrop-blur-xl, border-white/20, shadow-2xl. Uses Sheet component for bottom drawer with frosted black background (bg-black/95, backdrop-blur-md).
- **Capture Buttons**: Photo mode shows white circular button (20×20) with white inner circle. Video mode shows red button with square stop icon when recording. All buttons use hover:scale-105, active:scale-95 with shadow-lg for tactile feedback.
- **Design Philosophy**: Minimal, one-handed operation. Single natural tap target (center capture button). Frosted glass elements float above camera preview. All interactive elements sized for thumb reach. Consistent 250ms transitions with haptic feedback on mode switches.

### Enhanced Video Quality & Carousel Transitions (Oct 31, 2025)
- **Video Recording Quality**: Increased bitrate from 2.5 Mbps to 10 Mbps (4x improvement) for professional construction documentation. Videos now record at industry-standard quality (8-10 Mbps for 1080p) providing clear detail for dispute resolution and compliance.
- **Carousel Photo Viewer**: Implemented Apple Photos-style carousel with smooth sliding transitions. All photos/videos render in a horizontal track using CSS flexbox. GPU-accelerated transitions via `translate3d()` with 300ms cubic-bezier easing matching iOS timing standards.
- **Real-Time Drag Tracking**: Photos/videos follow finger during swipe gestures with instant visual feedback via `dragOffset` state. Transitions disable during drag and re-enable on release for natural feel.
- **Velocity-Based Navigation**: Fast flicks (>0.5 px/ms) trigger navigation even with shorter distances. Distance threshold set to 30% screen width or 100px minimum for reliable gesture detection.
- **Performance**: Zero bundle size increase (pure CSS transforms). Uses `willChange: transform` optimization during drag. All photos pre-rendered in carousel for instant navigation.

### Video Display Support (Oct 30, 2025)
- **Project Grid**: Videos now appear in ProjectPhotos grid with play icon overlay. Video thumbnails render with `<video>` elements using `preload="metadata"` for instant thumbnails without autoplay. Play icon overlay uses white/90 background with iOS Blue primary color.
- **Fullscreen Viewer**: PhotoGestureViewer displays videos with custom play/pause controls that preserve touch-swipe navigation. Video element uses `playsInline` to prevent iOS fullscreen takeover. Custom play button overlay (pointer-events-none wrapper with clickable button) appears only when video is paused. Touch handlers on both video and button ensure swipe gestures work from any touch point. Video state resets on navigation to prevent stale playback state.
- **Touch Navigation**: Videos support same swipe-to-navigate and long-press-to-delete gestures as photos. Tap anywhere on video to play/pause. All touch interactions work reliably on iOS Safari without native controls interfering with gesture recognition.

### Mobile UI Improvements (Oct 30, 2025)
- **Camera Mode**: Removed border line between controls. Removed pb-safe-4 padding and added mb-0.5 margin to zoom/tag controls to sit immediately above bottom buttons. Added mb-16 margin to main action buttons (Back/Video/Camera/Edit) to push them UP into thumb-friendly zone. This creates a tight, compact control cluster for one-handed operation.
- **Edit Mode**: Removed pb-safe-6 padding and added mb-0.5 margin to annotation tool controls (color picker, size, text, arrow, line, circle, pen, measure, undo, delete) to sit immediately above bottom buttons. Added mb-16 margin to save/cancel action rail to push buttons UP into thumb-friendly zone. Matches camera mode spacing pattern for consistent UX.
- **Projects Page**: Moved "Show Completed" toggle from bottom search bar to top section under New Project button for better accessibility. Raised bottom navigation from bottom-2 to bottom-4 with pb-safe-2 for better thumb reach. Search bar positioned at bottom-24 (increased from bottom-20) to prevent overlap with bottom navigation in Safari fullscreen mode. Added semi-transparent white background fill (h-28, z-30, pointer-events-none) at the bottom to prevent project content from showing through while keeping interactive elements clickable.
- **iOS Status Bar**: Made status bar transparent by updating theme-color to white and apple-mobile-web-app-status-bar-style to black-translucent in index.html. Added status bar initialization in App.tsx to enable overlay mode (transparent background) with dark style (dark text/icons) for light backgrounds. This provides an edge-to-edge native iOS feel.

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