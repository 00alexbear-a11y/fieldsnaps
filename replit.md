# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals. Its primary purpose is to provide robust offline photo and video documentation, aiming to enhance efficiency and minimize disputes. Key capabilities include instant media capture, smart compression, auto-timestamping, and efficient project organization. The project emphasizes full offline functionality and touch optimization, with ambitions to evolve into a commercial SaaS product.

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
The design follows an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, and typography, built on an 8px grid with a specific color palette. Interaction design focuses on fluid 0.3s easing animations, haptic feedback, natural gesture navigation (swipe-to-dismiss, swipe-to-delete), and progressive disclosure. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar using SF Symbols-inspired icons. Key UI elements like the camera interface and zoom controls utilize frosted glass effects, precise sizing for one-handed operation, and careful safe-area handling for notch devices. A CSS-first responsive design system ensures adaptability across all screen sizes without device detection, using mobile-first CSS, dynamic viewport units, and safe-area awareness for optimal touch targets.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers for caching, IndexedDB for local storage, and the Background Sync API for background uploads. Performance is optimized with lazy loading and Web Workers for image compression. Photos and videos are stored in Replit Object Storage. The camera module supports auto-start, instant capture, and video recording with real-time annotation. PDF export supports flexible grid layouts.

The application employs an Instagram/Google Photos-inspired session-based photo management system, keeping photos in IndexedDB throughout a camera session for instant access and smooth navigation. Intelligent quota management automatically cleans up old uploaded photos when storage limits are approached. WiFi-only upload controls allow users to restrict uploads to WiFi connections to save cellular data, with real-time UI indicators showing upload progress. An Upload Queue page provides manual management of sync statuses.

Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor integration provides a native-like iOS experience with native helpers for Haptic Feedback, Native Share, Status Bar Control, Network Detection, and more. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing.

### Feature Specifications
The application includes a bottom navigation bar, a comprehensive camera interface, and a To-Do system with photo attachments. The camera interface features session-based mode persistence and an in-camera session preview gallery with frosted glass overlay, 3-column grid, delete/edit/video playback features, and swipe-to-dismiss gesture (80px threshold, 0.4px/ms velocity). The camera bottom control bar uses pt-4 padding with pb-safe-2 bottom padding, with zoom controls floating above (not inside) the black bar. Project organization is card-based with photo counts and search. Photo management offers grid/timeline views, swipe actions, and batch selection. The Photo Annotation Editor provides tools for text, arrows, lines, circles, pens, and a tape measure. Photos are auto-named with project, date, and time. Additional features include an interactive map view, a 30-day trash bin, and bulk photo move functionality. The fullscreen photo viewer includes optimized bottom controls, an edit menu, and GPU-accelerated carousel transitions.

### System Design Choices
The architecture emphasizes simplicity and an invisible interface. The PWA infrastructure uses a Service Worker for hourly updates and offline caching. Storage leverages IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query and sync queue optimization, database indexing, and code-splitting. The offline sync system is hardened with queue size limits, exponential backoff, and atomic deduplication. OAuth for native apps uses the Capacitor Browser plugin. Critical performance enhancements include `crossOrigin='use-credentials'`, O(n) photo rendering with Map-based caching, `viewport-fit=cover`, and comprehensive CSS utilities for iOS safe-area handling. Virtualization with `@tanstack/react-virtual` is implemented for large photo collections, and global error toast notifications are managed via TanStack Query.

### Backend Performance Optimizations
Backend optimizations target mobile networks and high-concurrency scenarios. Compression via Gzip/Brotli reduces API payload sizes (70% reduction). Field filtering via query parameters allows mobile clients to request only needed data. Upload resilience is managed with 10-minute timeouts and per-user rate limiting (100 uploads/15min). Database performance is enhanced with indexes on key tables (photos.projectId, photos.userId, photos.uploadedAt, projects.userId) and in-memory response caching with user-scoped keys and per-endpoint TTLs, with cache invalidation after all mutations.

**Upload Performance Monitoring**: Real-time metrics tracking system monitors all upload methods (multipart, presigned, chunked) with success/failure rates, average duration by file size, retry frequency, error types, and method distribution. Accessible via GET `/api/uploads/metrics` for debugging and performance analysis.

### Intelligent Upload System
The application uses a 3-tier upload strategy optimized for different file sizes:

**Small Files (<5MB)**: Traditional multipart upload with thumbnail support
- Simple and efficient for typical photos
- Backend generates thumbnails inline
- Full metadata support

**Medium Files (5-20MB)**: Direct-to-cloud presigned URL uploads
- Bypasses backend for file content (metadata only)
- Faster uploads with reduced server load
- Client uploads directly to object storage
- Backend creates photo record after upload

**Large Files (>20MB)**: Chunked upload with retry logic
- Files split into 10MB chunks on client
- Each chunk uploads with 3 retries and exponential backoff (1s to 30s)
- Query parameter validation prevents disk space DoS attacks
- Backend assembles chunks, uploads to object storage atomically
- Automatic cleanup of expired sessions (24h) and orphaned chunks
- Session-based progress tracking for resumability
- Note: Thumbnail generation intentionally deferred (thumbnailUrl nullable)

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