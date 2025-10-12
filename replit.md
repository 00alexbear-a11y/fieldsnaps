# Construction Photo PWA

## Overview
This Progressive Web App (PWA) is designed to be an Apple-inspired, premium tool for construction professionals to capture and document job sites. Its core purpose is to provide an extremely simple, offline-reliable, and effortless photo documentation experience. The vision is to offer a fast, reliable, and user-friendly solution for field conditions, focusing on instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app aims for complete offline functionality, touch optimization for work gloves, and reliability in challenging environments.

## Recent Changes (October 2025)
### Phase 4: Camera & Photo Display Fixes (October 12, 2025)
- **Camera Permission Fix:** Camera no longer requests permission on every page load
  - Shows "Ready to Capture" screen when camera is not active
  - Camera only starts when user clicks a capture button
  - Waits for video metadata to load before allowing capture
  - Validates video dimensions before capture to prevent blob creation errors
  - Uses rear/environment camera by default (facingMode: 'environment')
- **Photo Display Fix:** Photos now display fully without cropping in annotation editor
  - Changed canvas drawing to scale full image: `ctx.drawImage(img, 0, 0, canvas.width, canvas.height)`
  - Maintains proper aspect ratio while ensuring complete visibility
  - Annotation coordinates still work correctly with scaled image
- **Zoom Removal:** Removed all zoom functionality from photo viewer per user request
  - Removed pinch-to-zoom, double-tap zoom, and mouse wheel zoom
  - Photos display at full size constrained to screen
  - Simplified photo viewer for easier use

### Phase 3: Mobile Annotation & Swipe Gestures (October 12, 2025)
- **Canvas Scaling Fix:** Fixed critical coordinate transformation bug in PhotoAnnotationEditor
  - Implemented `getCanvasCoordinates()` helper to properly scale display coordinates to canvas coordinates
  - Limited canvas width to 1200px to prevent memory issues while maintaining quality
  - Text overlay positioning now uses separate display coordinates for accurate placement
  - Touch events properly delegated to mouse handlers for consistent behavior
- **Swipe-to-Delete:** Added intuitive swipe gesture for project deletion
  - Left swipe on project cards reveals delete button (100px threshold)
  - Delete button stays visible after 150px swipe
  - Confirmation dialog with project details before deletion
  - Smooth animations and touch-optimized thresholds

### Phase 2: Enhanced Project Management & Comments
- **Projects Enhancement:** Added address field to projects

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
The design philosophy is "Apple-inspired," emphasizing extreme minimalism, content-first presentation, generous white space, subtle depth, typography excellence (San Francisco-inspired), and consistent 8px grid spacing.
- **Color Palette**: Primary iOS Blue (`#007AFF`), Secondary Warm Gray (`#8E8E93`), Success Green (`#34C759`), Warning Amber (`#FF9500`), Background Pure White (`#FFFFFF`) and Light Gray (`#F2F2F7`).
- **Interaction Design**: Fluid 0.3s easing animations, haptic feedback for key actions, natural gesture navigation, progressive disclosure of advanced features, and smart defaults.
- **Component Design**: Rounded buttons (8px), subtle card shadows, clean forms with floating labels, and a tab bar navigation with SF Symbols-inspired icons.

### Technical Implementations
- **Offline-First**: Service Worker with intelligent caching, IndexedDB for local photo storage (Blob storage), and complete app functionality without internet.
- **Background Sync**: Uses the Background Sync API for queued uploads with retry logic and batch operations.
- **Performance Optimizations**:
    - **Lazy Loading**: Implemented with Intersection Observer API for photos, including skeleton loading and smooth transitions.
    - **Web Workers**: For non-blocking image compression using `createImageBitmap()` and OffscreenCanvas, ensuring a responsive UI during CPU-intensive tasks.
    - **URL Lifecycle Management**: Strict revocation of temporary object URLs to prevent memory leaks.
- **Intelligent Photo System**:
    - Three compression levels (Standard 500KB, Detailed 1MB, Quick 200KB) using Canvas API compression and progressive JPEG optimization.
    - Instant thumbnail generation (150x150px) and smart aspect ratio preservation.
- **Authentication**: Optional Replit Auth with OpenID Connect, supporting biometric login (WebAuthn/FIDO2) for Touch ID, Face ID, and Windows Hello. PostgreSQL for session storage.
- **Onboarding**: A 3-step interactive onboarding flow for new users, managed by a localStorage flag.
- **PWA Installation**: Contextual install prompts after user engagement.

### Feature Specifications
- **Main Navigation**: 3 tabs – Camera, Projects, Settings.
- **Camera Interface**: Full-screen viewfinder, floating capture button, quality selector, recent photos carousel, quick project select.
- **Project Organization**: Card-based layout, photo count, search functionality, simple folder metaphor.
- **Photo Management**: Grid view, pinch-to-zoom, swipe actions, batch select, timeline view.
- **Upload Status**: Subtle progress indicators, smart notifications, and clear visual hierarchy for upload states.
- **Error Handling**: Graceful degradation, clear error messages, automatic retry logic, and offline mode indicators.

### System Design Choices
- **Build Philosophy**: Focus on doing fewer things exceptionally well, creating an invisible interface that allows users to focus on their work.
- **PWA Infrastructure**: Service Worker registered with hourly updates, offline caching, and background sync. PWA manifest configured with iOS blue branding and appropriate icons.
- **Storage Strategy**: IndexedDB with Blob storage for photos, intelligent quota management, and automatic thumbnail cleanup.

## External Dependencies

### Frontend
- **React**: JavaScript library for building user interfaces.
- **TypeScript**: Superset of JavaScript that adds static typing.
- **Vite**: Next-generation frontend tooling.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: Component library for React.
- **Wouter**: A tiny routing library for React.
- **TanStack Query**: Asynchronous state management library.

### Backend
- **Express.js**: Web application framework for Node.js.
- **PostgreSQL**: Relational database (Replit built-in).
- **Drizzle ORM**: TypeScript ORM for relational databases.

### PWA Technologies
- **Service Worker API**: For offline caching and background processes.
- **Web Manifest**: For PWA installation and metadata.
- **IndexedDB**: Client-side storage for structured data and Blobs.
- **Background Sync API**: For deferring network operations until connectivity is restored.

### Authentication
- **Replit Auth**: For user authentication, likely using OpenID Connect.
- **SimpleWebAuthn**: Library for WebAuthn/FIDO2 biometric authentication.