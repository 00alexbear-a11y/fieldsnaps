# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) for construction professionals, designed to provide robust offline photo and video documentation. Its core purpose is to enhance project efficiency, minimize disputes, and streamline organization through features like instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product, offering full offline functionality and touch optimization to address critical needs in construction documentation.

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
The design adopts an Apple-inspired aesthetic with minimalism, clear typography, and an 8px grid, featuring fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, and a tab bar with SF Symbols-inspired icons. The camera interface is optimized for one-handed use with frosted glass effects. A CSS-first, mobile-first responsive design ensures adaptability across all screen sizes, including a split-screen before/after comparison and a redesigned landing page. Unified navigation and a single header with contextual actions provide a consistent user experience.

### Technical Implementations
FieldSnaps is an offline-first PWA, utilizing Service Workers, IndexedDB, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera supports instant capture, video, and real-time annotation. It features Instagram/Google Photos-inspired session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Replit Auth with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor provides a native-like iOS experience. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing. Key features include a bottom navigation bar, comprehensive camera interface, in-camera session preview, a To-Do system with photo attachments, and card-based project organization. Photo management offers various views, swipe actions, and batch selection, complemented by a Photo Annotation Editor. An interactive map view, 30-day trash bin, bulk photo move, and fullscreen photo viewer are also included. User-scoped project preferences and an activity feed provide multi-user accountability. A timezone-safe time tracking system with Clock In/Out functionality and timesheets, including state validation for clock entries, is integrated. A "Snap & Speak" camera mode allows rapid task creation via photo and voice recognition, using `TodoSessionContext` for client-side staging and transactional batch saving.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. The PWA uses a Service Worker for hourly updates and offline caching. Storage uses IndexedDB for Blobs, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system includes queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Manual deletion checks for `serverId`. Global error notifications are managed via TanStack Query. Production readiness is ensured with React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations include compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system.

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
- **@capacitor/core**: Core functionality and platform detection
- **@capacitor/app**: App lifecycle management
- **@capacitor/browser**: Opens OAuth URLs
- **@capacitor/device**: Device information
- **@capacitor/preferences**: Native storage
- **@capacitor/filesystem**: Native file system access
- **@capacitor/camera**: Native camera integration
- **@capacitor/haptics**: Native haptic feedback
- **@capacitor/share**: Native iOS share sheet
- **@capacitor/status-bar**: Native status bar control
- **@capacitor/network**: Native network detection
- **@capacitor/clipboard**: Native clipboard operations
- **@capacitor/keyboard**: Native keyboard management
- **@capacitor/splash-screen**: Native splash screen control
- **@capacitor-community/speech-recognition**: Native speech recognition for iOS/Android

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion
- **Stripe**: Web subscription management and payment processing