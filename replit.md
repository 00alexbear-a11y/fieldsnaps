# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired, premium Progressive Web App (PWA) designed for construction professionals to capture and document job sites. Its core purpose is to provide an extremely simple, offline-reliable, and effortless photo documentation experience, focusing on instant photo capture, smart compression, auto-timestamping, and efficient project organization. The app aims for complete offline functionality, touch optimization for work gloves, and reliability in challenging environments, ultimately enhancing efficiency and reducing disputes in construction projects.

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
The design philosophy is "Apple-inspired," emphasizing extreme minimalism, content-first presentation, generous white space, subtle depth, typography excellence, and consistent 8px grid spacing. The color palette includes primary iOS Blue (`#007AFF`), secondary Warm Gray (`#8E8E93`), Success Green (`#34C759`), Warning Orange (`#FF9500`), and background colors Pure White (`#FFFFFF`) and Light Gray (`#F2F2F7`). Interaction design features fluid 0.3s easing animations, haptic feedback, natural gesture navigation, progressive disclosure, and swipe-to-delete functionality. Components use rounded buttons (8px), subtle card shadows, clean forms with floating labels, and a tab bar navigation with SF Symbols-inspired icons. Branding features the FieldSnaps logo prominently across key screens. The bottom navigation is restructured with "Map," "Projects," "Inbox," and "Camera" tabs, with Settings moved to the Projects page header.

### Technical Implementations
FieldSnaps is built as an offline-first PWA, leveraging Service Workers for intelligent caching and IndexedDB for local photo storage, ensuring full functionality without internet access. Background Sync API handles queued uploads with retry logic. Performance is optimized through lazy loading (Intersection Observer API), Web Workers for non-blocking image compression, and strict URL lifecycle management. The intelligent photo system offers three compression levels (Standard 500KB, Detailed 1MB, Quick 200KB) using Canvas API, instant thumbnail generation, and aspect ratio preservation.

**Photo Storage Architecture:** Photos are stored using Replit Object Storage for persistent cloud storage. The upload flow uses presigned URLs for direct client-to-storage uploads, with server-side ACL policies ensuring proper access control. Each photo has an owner (user ID) and visibility setting (public for sharing). Object storage paths are normalized and stored in the database, while IndexedDB maintains local blob caches for offline access. The sync manager coordinates uploads from IndexedDB to object storage when connectivity is available. When photos are permanently deleted (either individually or through trash cleanup), the underlying object storage files are automatically removed to prevent storage bloat and orphaned files.

Camera functionality includes auto-start, instant capture workflows (Quick Capture, Capture & Edit), project-specific pre-selection, and immersive full-screen viewfinders with glassmorphic controls. Photo sharing supports multi-photo selection, date-grouped timeline views, and public read-only share pages. Authentication is managed via Replit Auth with OpenID Connect and supports biometric login (WebAuthn/FIDO2). An interactive 3-step onboarding flow guides new users, and contextual prompts support PWA installation. The application includes robust error resilience via React Error Boundaries and standardized API error handling. Service Worker updates are user-notified for new app versions.

### Feature Specifications
The application features bottom navigation with "Map," "Projects," "Inbox," and "Camera" tabs (left to right). Settings moved to top-right header in Projects page. The camera interface includes a project selection screen, full-screen viewfinder, floating capture button, quality selector, zoom levels (1x/2x/3x), and a centered camera flip button. Project organization uses a card-based layout with photo counts, search, and address buttons. Photo management provides grid and timeline views, swipe actions, batch selection, and bottom bar controls for editing, sharing, commenting, deleting, and renaming.

The Photo Annotation Editor v4 features a redesigned layout with fixed cancel (X) button in top-left and save (✓) button in top-right. The left sidebar contains a scrollable color picker, and size selection (S/M/L) is implemented as fixed tab buttons. The bottom toolbar is non-scrollable and contains all annotation tools (text, arrow, line, circle, pen) plus undo and delete buttons. Text annotations support scaling and rotation. Upload status is indicated by subtle progress, smart notifications, and clear visual hierarchy. Auto-naming of photos uses the format `[ProjectName]_[Date]_[Time]`. Key features include an interactive map view displaying geocoded projects, a 30-day trash bin for soft-deleted items with restore and permanent delete options, and bulk photo move functionality.

### System Design Choices
The build philosophy centers on simplicity and invisible interface design. The PWA infrastructure relies on a Service Worker with hourly updates and offline caching. The storage strategy utilizes IndexedDB for Blob storage of photos, intelligent quota management, and automatic thumbnail cleanup. Performance optimizations include database query optimization (eliminating N+1, single query approach), sync queue optimization (batch processing, smart prioritization, exponential backoff), and database indexing.

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
- **Replit Object Storage**: Cloud object storage for persistent photo storage with ACL-based access control.

### PWA Technologies
- **Service Worker API**: For offline caching and background processes.
- **Web Manifest**: For PWA installation and metadata.
- **IndexedDB**: Client-side storage for structured data and Blobs.
- **Background Sync API**: For deferring network operations until connectivity is restored.

### Authentication
- **Replit Auth**: For user authentication.
- **SimpleWebAuthn**: Library for WebAuthn/FIDO2 biometric authentication.

### Third-Party APIs
- **Google Geocoding API**: For converting addresses to latitude/longitude coordinates.

## Future: Production Infrastructure Strategy

**Status**: Planned for after core UX refinement is complete  
**Target**: Commercial SaaS product competing with CompanyCam ($387/month) at $19.99/month

### Production Service Stack ($175/month + ~$0.88/user)

**Revenue Engine:**
- **Stripe**: Payment processing (2.9% + 30¢) = $19.11 profit per user

**Infrastructure Services:**
1. **Cloudflare Pro ($20/mo)**: Global CDN, SSL, DDoS protection
2. **Supabase Pro ($25/mo)**: PostgreSQL with guaranteed performance SLAs
3. **Cloudinary Advanced ($89/mo)**: Photo storage, optimization, global delivery CDN
4. **Postmark Growth ($15/mo)**: Transactional email for billing/notifications
5. **Sentry Business ($26/mo)**: Error monitoring and performance tracking

### Migration Approach: Backend-First

**Phase 1: Database & Auth (Week 1-2)**
- Migrate to Supabase Pro with subscription schema
- User fields: `subscription_status`, `stripe_customer_id`, `trial_end_date`
- Subscription tracking: status, billing periods, payment methods

**Phase 2: Photo Storage (Week 2-3)**
- Migrate to Cloudinary Advanced for automatic optimization
- Benefits: 60-80% bandwidth reduction, global CDN, auto-thumbnails, WebP/AVIF support
- Photo schema: `cloudinary_public_id`, `cloudinary_url`, `thumbnail_url`

**Phase 3: Billing Integration (Week 3-4)**
- Stripe subscription system with 7-day free trial
- Postmark email automation (welcome, trial reminders, payment notifications)
- Webhook handlers for payment events

**Phase 4: Production Launch (Week 5-7)**
- Cloudflare CDN configuration
- Sentry error monitoring
- Production deployment with 99.9% uptime target

### Business Logic

**Subscription Model:**
- Single tier: $19.99/month
- 7-day free trial (no credit card required)
- Trial reminders: 3 days, 1 day before expiration
- Grace period for failed payments

**Success Metrics:**
- Photo upload success rate: >99%
- Global photo load time: <500ms
- Database query time: <100ms
- Trial-to-paid conversion: >25%
- App load time: <2 seconds

### API Architecture (Production-Ready)

**Authentication:**
- `POST /api/auth/register`, `/login`, `/refresh-token`
- `POST /api/auth/forgot-password`, `/reset-password`

**Billing (Stripe):**
- `POST /api/billing/create-subscription`
- `POST /api/billing/cancel-subscription`
- `POST /api/billing/update-payment-method`
- `POST /api/billing/webhooks` (Stripe webhook handler)

**User Management:**
- `GET /api/user/profile`, `/subscription`
- `PUT /api/user/profile`
- `DELETE /api/user/account`

**Core Features:** (Photos, Projects, Analytics remain similar with subscription checks)

### Development Philosophy

**Current Focus**: Core UX and feature fluidity  
**Production Trigger**: When core experience feels "magical"  
**Migration Strategy**: Backend infrastructure won't affect UI/UX improvements