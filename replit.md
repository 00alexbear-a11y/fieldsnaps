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
The design adheres to an "Apple-inspired" philosophy, emphasizing minimalism, content-first presentation, generous white space, subtle depth, and typography excellence, all based on an 8px grid. The color palette includes iOS Blue, Warm Gray, Success Green, Warning Orange, Pure White, and Light Gray. Interaction design incorporates fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete. Components include rounded buttons, subtle card shadows, clean forms with floating labels, and a tab bar utilizing SF Symbols-inspired icons. The branding prominently features the FieldSnaps logo. The bottom navigation includes "Map," "Projects," "To-Do," and "Camera" tabs, with Settings accessible from the Projects page header.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers for caching and IndexedDB for local photo and video storage. The Background Sync API manages queued uploads. Performance is optimized through lazy loading, Web Workers for image compression, and strict URL lifecycle management. The intelligent photo system offers three compression levels via the Canvas API, instant thumbnail generation, and universal 4:3 aspect ratio enforcement. **All photos are enforced to 4:3 aspect ratio** from all sources: (1) camera captures use `getUserMedia` constraints (ideal: 1920x1440) with canvas center-cropping fallback regardless of device capabilities, and (2) manual file uploads are automatically center-cropped to 4:3 and converted to JPEG before storage. Photos and videos are stored in Replit Object Storage, using presigned URLs for upload and server-side ACL policies, with a `mediaType` field to distinguish between photos and videos. Camera functionality includes auto-start, instant capture workflows (Quick Capture, Capture & Edit), project-specific pre-selection, full-screen viewfinders, video recording with real-time annotation, and native HTML5 playback. **PDF export** supports flexible grid layouts (1, 2, 3, or 4 photos per page) with customizable detail options (project header, name, date, timestamp, tags, comments); all images are center-cropped to 4:3 aspect ratio in PDFs to maintain visual consistency without stretching. A Stripe-integrated subscription system includes a 7-day free trial, soft block enforcement, and a mission-focused billing success page. Project completion tracking allows marking projects as complete/incomplete. Photo sharing supports multi-photo selection, date-grouped timeline views, and public read-only share pages. Authentication uses Replit Auth with OpenID Connect and supports biometric login.

### Feature Specifications
The application features a bottom navigation with "Map," "Projects," "To-Do," and "Camera" tabs. The camera interface uses a three-zone layout (≥75% viewfinder height): (1) compact header with project selector and flip camera button only; (2) dominant viewfinder (flex-1, displayed in 16:9 aspect ratio via CSS) with video stream, annotation canvas for recording, and horizontal session photo preview strip overlaid at bottom (last 5 photos with rounded thumbnails, video play icons, tag indicators); (3) controls row with quality toggle buttons (S/M/L), zoom controls (1x/2x/5x based on device), and auto-tag dropdown; (4) bottom action rail with four buttons in order: Back (navigates to previous page), Video (toggles recording state), Camera (instant photo capture), To-Do (capture → annotate → create assigned task), and Edit Mode (photo → annotation editor). Photos are captured at full original resolution without any cropping, while the viewfinder displays in 16:9 aspect ratio for optimal screen space usage. 

The To-Do system enables team task management with photo attachments. Users can create tasks from captured photos (camera → annotate → assign), view tasks in three contexts (My Tasks: assigned to me, Team Tasks: all company tasks, I Created: tasks I created), filter by status (Active/Completed), and complete/delete tasks. Tasks include title, description, optional project/photo linking, assignment to team members, and completion tracking. The workflow integrates seamlessly: capture issue with camera, annotate on photo, create assigned to-do.

Project organization is card-based with photo counts, search, and address buttons, and the ability to filter and mark projects as complete. Photo management offers grid and timeline views, swipe actions, batch selection, and controls for editing, sharing, commenting, deleting, and renaming. The Photo Annotation Editor features a centered visual island layout optimized for 4:3 photos: S/M/L size selector at top (top-36, below zoom circle), horizontal color picker above tool buttons showing all 10 colors (bottom-20), tool buttons centered at bottom (text, arrow, line, circle, pen, tape measure, undo, delete), and Cancel/Save buttons in bottom corners. Text annotations support scaling and rotation. The tape measure annotation tool renders measurements as horizontal lines with end caps displaying feet'inches" format above (e.g., "5'9"", "10'0"", "0'6""), and supports drag-to-move, rotation, and scaling like text annotations. Photo auto-naming follows the format `[ProjectName]_[Date]_[Time]`. Additional features include an interactive map view for geocoded projects, a 30-day trash bin for soft-deleted items, and bulk photo move functionality.

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