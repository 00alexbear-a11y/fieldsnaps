# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired, premium Progressive Web App (PWA) designed for construction professionals to capture and document job sites. Its core purpose is to provide an extremely simple, offline-reliable, and effortless photo documentation experience, focusing on instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app aims for complete offline functionality, touch optimization for work gloves, and reliability in challenging environments.

## Recent Changes (October 2025)
- **Enhanced Sync Status**: Added photo thumbnail previews to sync status page with project names and clickable full-screen view. Implemented proper object URL lifecycle management to prevent memory leaks.
- **Bulk Photo Move**: Users can now select multiple photos and move them between projects via an intuitive dialog interface.
- **Quick Camera Access**: Added camera icon buttons to each project card for instant camera access with that project pre-selected.
- **Navigation Refinement**: Removed back button from main projects list view for cleaner UX, while maintaining it within individual project views.
- **Text Annotation Enhancement**: Upgraded text tool with scaling (blue handle on right) and rotation (green handle on top) capabilities using visual drag handles.

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
The design philosophy is "Apple-inspired," emphasizing extreme minimalism, content-first presentation, generous white space, subtle depth, typography excellence, and consistent 8px grid spacing. Key elements include a grayscale theme for destructive actions, a full-screen photo editor, contextual sync banner visibility, and a relocated camera Floating Action Button (FAB).
- **Branding**: FieldSnaps logo displayed prominently on Projects page, Settings page, Camera project selection screen, and onboarding flow.
- **Color Palette**: Primary iOS Blue (`#007AFF`), Secondary Warm Gray (`#8E8E93`), Success Green (`#34C759`), Warning Orange (`#FF9500` - updated from amber), Background Pure White (`#FFFFFF`) and Light Gray (`#F2F2F7`).
- **Interaction Design**: Fluid 0.3s easing animations, haptic feedback for key actions, natural gesture navigation, progressive disclosure of advanced features, and smart defaults, including swipe-to-delete functionality.
- **Component Design**: Rounded buttons (8px), subtle card shadows, clean forms with floating labels, and a tab bar navigation with SF Symbols-inspired icons.

### Technical Implementations
- **Offline-First**: Service Worker with intelligent caching, IndexedDB for local photo storage, and complete app functionality without internet.
- **Background Sync**: Uses the Background Sync API for queued uploads with retry logic.
- **Performance Optimizations**: Lazy Loading with Intersection Observer API, Web Workers for non-blocking image compression, and strict URL lifecycle management to prevent memory leaks.
- **Intelligent Photo System**: Three compression levels (Standard 500KB, Detailed 1MB, Quick 200KB) using Canvas API, instant thumbnail generation, and aspect ratio preservation. Photos display fully without cropping in the annotation editor.
- **Camera Functionality**: Auto-starts camera on tab open, instant capture workflow (Quick Capture, Capture & Edit), camera pre-selection for projects, and bottom navigation auto-hide for immersive experiences. Enhanced camera reliability with proper initialization and error handling.
- **Photo Sharing**: Multi-photo selection, date-grouped timeline view, and public read-only share pages with a share link dialog and copy-to-clipboard functionality.
- **Authentication**: Optional Replit Auth with OpenID Connect, supporting biometric login (WebAuthn/FIDO2).
- **Onboarding**: A 3-step interactive onboarding flow.
- **PWA Installation**: Contextual install prompts.

### Feature Specifications
- **Main Navigation**: 3 tabs – Camera, Projects, Settings.
- **Camera Interface**: Project selection screen before camera opens, full-screen viewfinder with glassmorphic controls, floating capture button, quality selector, zoom level selector (1x/2x/3x), centered camera flip button. Project selector removed from camera view.
- **Project Organization**: Card-based layout with FieldSnaps logo header, photo count, search, address button (prevents accidental map navigation), and simple folder metaphor.
- **Photo Management**: Grid view, swipe actions, batch select, timeline view. Photo viewer controls (Edit, Share, Comment, Delete, Rename) relocated to bottom bar for better accessibility.
- **Photo Annotation Editor**: Left sidebar with all 7 colors, right sidebar with tools (arrow, circle, line, pen, text). Arrow tool includes 5x magnified zoom circle in top-right corner for precision placement. Tools positioned close to screen edges for easier thumb access.
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