# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals. Its primary purpose is to provide effortless, offline-reliable photo and video documentation to enhance efficiency and reduce disputes in construction projects. Key capabilities include instant media capture, smart compression, auto-timestamping, efficient project organization, and a mission-driven SaaS model that donates 20% of proceeds to missionaries. The project aims for full offline functionality and touch optimization, aspiring to become a commercial SaaS product.

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
The design adheres to an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, subtle depth, and typography excellence, all based on an 8px grid. The color palette includes iOS Blue, Warm Gray, Success Green, Warning Orange, Pure White, and Light Gray. Interaction design incorporates fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons. The branding prominently features the FieldSnaps logo. The bottom navigation includes "Map," "Projects," "Inbox," and "Camera" tabs, with Settings accessible from the Projects page header.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers for caching and IndexedDB for local photo and video storage. The Background Sync API manages queued uploads. Performance is optimized through lazy loading, Web Workers for image compression, and strict URL lifecycle management. The intelligent photo system offers three compression levels via the Canvas API, instant thumbnail generation, and aspect ratio preservation. Photos and videos are stored in Replit Object Storage, using presigned URLs for upload and server-side ACL policies, with a `mediaType` field to distinguish between photos and videos. Camera functionality includes auto-start, instant capture workflows (Quick Capture, Capture & Edit), project-specific pre-selection, full-screen viewfinders, video recording with real-time annotation, and native HTML5 playback. A Stripe-integrated subscription system includes a 7-day free trial, soft block enforcement, and a mission-focused billing success page. Project completion tracking allows marking projects as complete/incomplete. Photo sharing supports multi-photo selection, date-grouped timeline views, and public read-only share pages. Authentication uses Replit Auth with OpenID Connect and supports biometric login.

### Feature Specifications
The application features a bottom navigation with "Map," "Projects," "Inbox," and "Camera" tabs. The camera interface has been redesigned with a framed viewfinder layout (~65% height in rounded-3xl box) on dark background, featuring: header bar with back button/project dropdown/info icon; horizontal session photo preview strip (last 5 photos); compact tools row with S/M/L quality toggle buttons, dynamic zoom controls (1x/2x/5x based on device), and flip camera button; auto-tag dropdown for pre-applying tags to captures; and bottom action buttons (X cancel, large circular capture button, flip camera). Project organization is card-based with photo counts, search, and address buttons, and the ability to filter and mark projects as complete. Photo management offers grid and timeline views, swipe actions, batch selection, and controls for editing, sharing, commenting, deleting, and renaming. The Photo Annotation Editor has a redesigned layout with fixed cancel/save buttons, a scrollable color picker, size selection (S/M/L) as fixed tabs, and a non-scrollable bottom toolbar for annotation tools (text, arrow, line, circle, pen, tape measure), undo, and delete. Text annotations support scaling and rotation. The tape measure annotation tool renders measurements as horizontal lines with end caps displaying feet'inches" format above (e.g., "5'9"", "10'0"", "0'6""), and supports drag-to-move, rotation, and scaling like text annotations. Photo auto-naming follows the format `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view for geocoded projects, a 30-day trash bin for soft-deleted items, and bulk photo move functionality.

### System Design Choices
The build philosophy emphasizes simplicity and invisible interface design. The PWA infrastructure relies on a Service Worker for hourly updates and offline caching. The storage strategy uses IndexedDB for Blob storage, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query optimization, sync queue optimization (batch processing, smart prioritization, exponential backoff), and database indexing.

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
- **Replit Object Storage**: Cloud object storage for persistent photo storage.

### PWA Technologies
- **Service Worker API**: For offline caching and background processes.
- **Web Manifest**: For PWA installation and metadata.
- **IndexedDB**: Client-side storage for structured data and Blobs.
- **Background Sync API**: For deferring network operations.

### Authentication
- **Replit Auth**: For user authentication.
- **SimpleWebAuthn**: Library for WebAuthn/FIDO2 biometric authentication.

### Third-Party APIs
- **Google Geocoding API**: For converting addresses to latitude/longitude coordinates.
- **Stripe**: For subscription management and payment processing.