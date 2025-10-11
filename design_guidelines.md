# Photo PWA Design Guidelines

## Design Approach
**Hybrid Approach**: Material Design foundation with inspiration from modern camera applications (Instagram Camera, iOS Camera, Google Camera). Focus on utility and performance while maintaining visual appeal for photo-centric experience.

**Core Principles**:
- Mobile-first, touch-optimized interface
- Minimal UI during capture for distraction-free photography
- Dark-dominant theme to reduce glare and focus on photos
- Instant feedback for all interactions

## Color Palette

**Dark Mode Primary** (Default):
- Background: 220 20% 12% (deep slate)
- Surface: 220 18% 16% (elevated slate)
- Primary: 210 100% 60% (vibrant blue)
- Accent: 280 70% 65% (soft purple)
- Text Primary: 0 0% 98%
- Text Secondary: 220 10% 70%

**Light Mode**:
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary: 210 100% 50%
- Text Primary: 220 20% 12%

**Functional Colors**:
- Success (capture): 142 70% 55%
- Danger (delete): 0 70% 60%
- Warning: 45 90% 55%

## Typography

**Font Stack**:
- Primary: 'Inter', system-ui, sans-serif (via Google Fonts)
- Monospace: 'JetBrains Mono' for technical info (file sizes, timestamps)

**Scale**:
- Hero/Display: text-4xl to text-6xl, font-bold (camera mode titles)
- Headers: text-2xl to text-3xl, font-semibold
- Body: text-base, font-normal
- Small/Meta: text-sm, font-medium
- Micro: text-xs (timestamps, file info)

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing: p-2, gap-2 (camera controls)
- Standard: p-4, gap-4 (cards, buttons)
- Generous: p-8, gap-8 (page sections)
- Extra: p-12, p-16 (hero, feature areas)

**Grid System**:
- Camera view: Full viewport (h-screen)
- Gallery: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 with gap-2
- Container max-width: max-w-7xl mx-auto

## Component Library

### Camera Interface
- **Viewfinder**: Full-screen video preview with minimal overlay
- **Shutter Button**: 80px circular button, centered bottom, elevated with shadow-2xl, subtle scale animation on tap
- **Control Bar**: Bottom sheet overlay (bg-black/80 backdrop-blur-md), height 24, contains flip camera, flash toggle
- **Mode Indicator**: Top-left pill showing current mode (Photo/Video), subtle badge

### Gallery View
- **Photo Grid**: Masonry-style grid, aspect-square cards with rounded-lg, overflow-hidden
- **Photo Card**: Hover/tap state with opacity-90, subtle scale transform
- **Empty State**: Centered icon (camera outline) with text-lg message, muted colors
- **Photo Actions**: Floating action menu (share, delete, download) appearing on long-press/click

### Navigation
- **App Bar**: Fixed top, h-16, backdrop-blur-md bg-slate-900/80, contains app title and settings icon
- **Tab Bar**: Fixed bottom (when not in camera mode), h-16, two tabs: Camera & Gallery, icon + label

### Forms & Inputs
- **Settings Panel**: Slide-in panel from right, w-80, dark surface
- **Toggle Switches**: Material-style switches for flash, grid overlay, quality settings
- **Select Dropdowns**: Custom styled with rounded-lg, border-slate-700

### Overlays
- **Photo Preview Modal**: Full-screen overlay, backdrop-blur-xl, centered image with pinch-zoom support
- **Delete Confirmation**: Bottom sheet modal, rounded-t-3xl, red accent for destructive action
- **Share Sheet**: Native-style bottom sheet with sharing options grid

### Buttons
- **Primary (Capture)**: 80px circle, bg-primary with ring-4 ring-primary/30, shadow-2xl
- **Secondary (Controls)**: 48px circles, bg-white/10 backdrop-blur, border border-white/20
- **Icon Buttons**: 40px touch target, p-2, rounded-full, hover:bg-white/10
- **Text Buttons**: Minimal, text-primary, font-medium, underline-offset-4 hover:underline

## Animations

**Essential Only**:
- Shutter button: Scale 0.95 on active (150ms ease-out)
- Capture flash: White overlay fade (200ms) simulating camera flash
- Photo grid: Stagger fade-in (100ms delay per item)
- Modal transitions: Slide up/fade (250ms ease-in-out)
- NO continuous animations, NO decorative effects

## Images

**Hero Section**: NOT APPLICABLE - Camera app launches directly to camera view

**Gallery Images**:
- User-captured photos displayed in grid
- Thumbnail size: 300x300px (cropped to square)
- Full resolution on preview modal
- Lazy loading with blur-up placeholder effect

**Empty States**:
- Camera icon SVG (Heroicons camera-outline) 
- Gallery empty state: Image stack icon with "No photos yet" message

**Icon Library**: Heroicons (outline style) via CDN for all UI icons

## Responsive Behavior

**Mobile (default)**:
- Camera: Full viewport, portrait orientation lock encouraged
- Gallery: 2-column grid, gap-2
- Touch targets: Minimum 44px

**Tablet (md:)**:
- Gallery: 3-column grid, gap-3
- Settings panel: Wider (w-96)

**Desktop (lg:)**:
- Gallery: 4-column grid, gap-4
- Optional: Side-by-side camera + gallery view
- Mouse hover states enabled

## PWA-Specific Design

- **Install Prompt**: Subtle banner at top, dismissible, reappears after 3 days
- **Splash Screen**: Dark background with app icon centered, app name below
- **App Icon**: Camera lens graphic, vibrant blue gradient (210 100% 60% to 280 70% 65%)
- **Offline Indicator**: Toast notification at bottom when network unavailable

## Accessibility

- Focus indicators: ring-2 ring-primary ring-offset-2 ring-offset-slate-900
- Reduced motion: Disable all animations for prefers-reduced-motion users
- ARIA labels: All icon-only buttons have descriptive labels
- Color contrast: WCAG AAA for all text on backgrounds
- Keyboard navigation: Full camera control via spacebar (capture), arrow keys (mode switch)