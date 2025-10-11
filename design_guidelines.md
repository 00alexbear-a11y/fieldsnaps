# Construction Photo Documentation PWA Design Guidelines

## Design Approach
**Apple HIG Reference-Based**: Pure iOS design language prioritizing clarity, deference, and depth. Content-first philosophy with generous whitespace and minimal chrome. Optimized for construction workers using glove-friendly touch targets and instant visual feedback.

**Core Principles**:
- Content above interface
- Clarity through hierarchy and motion
- Depth through layering and translucency
- Effortless interaction with minimal cognitive load

## Color Palette

**Light Mode Primary**:
- Background: 0 0% 100% (pure white)
- Surface: 0 0% 97% (subtle gray for cards)
- System Blue: 211 100% 50% (#007AFF)
- Success Green: 145 63% 49% (#34C759)
- Warning Amber: 28 100% 50% (#FF9500)
- Warm Gray: 240 2% 56% (#8E8E93)

**Text Hierarchy**:
- Primary: 0 0% 0% (true black)
- Secondary: 240 2% 24% (#3C3C43)
- Tertiary: 240 2% 56% (#8E8E93)

**Functional Colors**:
- Destructive: 0 100% 59% (iOS red)
- Disabled: 240 2% 56% with 40% opacity

## Typography

**Font Stack**:
- Primary: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif
- Monospace: 'SF Mono', 'Monaco', monospace (timestamps, measurements)

**Scale** (iOS-aligned):
- Large Title: text-[34px] leading-[41px] font-bold (page headers)
- Title 1: text-[28px] leading-[34px] font-bold
- Title 2: text-[22px] leading-[28px] font-bold
- Title 3: text-[20px] leading-[25px] font-semibold
- Headline: text-[17px] leading-[22px] font-semibold
- Body: text-[17px] leading-[22px] font-normal
- Callout: text-[16px] leading-[21px] font-normal
- Subheadline: text-[15px] leading-[20px] font-normal
- Footnote: text-[13px] leading-[18px] font-normal
- Caption: text-[12px] leading-[16px] font-normal

## Layout System

**8px Grid System**: All spacing uses multiples of 8px
- Micro: 8px (element internal padding)
- Tight: 16px (related elements)
- Standard: 24px (section padding)
- Generous: 32px (major sections)
- Extra: 48px (hero spacing)

**Safe Areas**:
- Top inset: 44px (status bar + navigation)
- Bottom inset: 83px (tab bar + safe area)
- Horizontal padding: 16px (page margins)

**Grid System**:
- Photo Grid: 2 columns mobile, 3 tablet, 4 desktop with 8px gap
- Container: max-w-screen-xl with 16px horizontal padding

## Component Library

### Camera Interface
- **Viewfinder**: Full viewport with subtle corner guides (hairline borders in warm gray)
- **Shutter Button**: 70px white circle with 4px system blue ring, centered 24px from bottom, smooth scale to 0.92 on press
- **Control Strip**: Bottom toolbar (h-20) with frosted glass effect (bg-white/80 backdrop-blur-xl), contains flash, grid, timer toggles
- **Mode Selector**: Segmented control at top (Photo/Video/Pano), 44px height, system blue active state
- **Level Indicator**: Minimal yellow crosshair when device tilted

### Projects View
- **Project Cards**: White cards with 8px radius, 1px border (black/5%), gentle shadow (0 2px 8px rgba(0,0,0,0.1))
- **Card Header**: Project name (Headline weight), date range (Subheadline, secondary color), 16px padding
- **Photo Count Badge**: System blue pill with white text, positioned top-right
- **Thumbnail Grid**: 3-photo preview in card, aspect-square, 4px radius
- **Empty State**: Construction hat icon (SF Symbol style), "Start Your First Project" in secondary text

### Navigation
- **Tab Bar**: Fixed bottom, 83px total height (49px bar + 34px safe area), frosted glass (bg-white/80 backdrop-blur-xl), hairline top border
- **Tab Items**: Icon + label stack, system blue when active, warm gray inactive, 44px touch target
- **Page Headers**: Large Title (34px) with 16px top padding, fades to inline on scroll

### Photo Detail View
- **Full Screen Display**: Edge-to-edge photo with pinch-zoom, double-tap 2x zoom
- **Info Overlay**: Bottom sheet (rounded-t-3xl), displays project, timestamp, GPS, notes
- **Action Bar**: Top bar with Share (system blue), Delete (destructive red), Edit icons, 44px touch targets
- **Annotation Tools**: Markup toolbar slides up from bottom, contains pen, text, arrow, measure tools

### Settings Panel
- **Grouped List Style**: iOS Settings aesthetic with section headers (Footnote, uppercase, warm gray)
- **Toggle Rows**: 44px height, label left, system switch right, divider lines (black/10%)
- **Navigation Rows**: Chevron right indicator, 44px touch target
- **Quality Picker**: Inline segmented control (High/Medium/Low) with system blue selection

### Forms & Inputs
- **Text Fields**: 44px height, 8px radius, 1px border (warm gray), focus state adds system blue border
- **Date Picker**: iOS-native wheel picker, frosted bottom sheet presentation
- **Photo Picker**: Grid selector with multi-select checkmarks (system blue circles)
- **Notes Field**: Expandable text area, 8px radius, same border treatment

### Buttons
- **Primary**: System blue fill, white text, 44px height, 8px radius, font-semibold
- **Secondary**: White fill, system blue text, 1px system blue border, same dimensions
- **Destructive**: Destructive red with white text
- **Borderless**: System blue text only, 44px touch target, no background
- **Icon Buttons**: 44px circular touch target, warm gray icon, system blue on active

### Overlays
- **Action Sheets**: Bottom sheet with rounded-t-3xl, options list with 44px rows, cancel button separated
- **Alerts**: Centered modal, 270px width, 8px radius, title (Headline), message (Body), button stack
- **Loading**: System blue activity indicator, centered on frosted overlay

## Animations

**iOS-Standard Easing** (cubic-bezier(0.4, 0.0, 0.2, 1)):
- Shutter capture: Scale 0.92 with spring bounce (0.3s)
- Modal present: Slide up + fade (0.35s)
- Tab switch: Crossfade content (0.25s)
- Card tap: Gentle scale 0.98 (0.15s)
- Page transitions: Slide horizontal 100% (0.35s)
- Pull to refresh: Elastic resistance with spinner reveal

## Images & Icons

**Icons**: SF Symbols aesthetic via Heroicons
- Camera, folder, gear, share, trash, pencil, grid, flash, timer
- 24px base size, scale to 28px for tab bar
- Stroke width: 2px (regular weight)

**Photos**:
- Captured images: Full resolution stored, 600px thumbnails generated
- Grid display: aspect-square crops, 4px radius
- Detail view: Original aspect ratio, edge-to-edge presentation
- Blur placeholders: 20px blur with gradual focus load

**Empty States**:
- Construction imagery: Hard hat icon, blueprint icon, camera with plus
- Illustrations use system blue with warm gray accents

## Responsive Behavior

**Mobile (Default)**:
- Single column layouts
- Full-width cards with 16px margins
- 2-column photo grids
- Portrait camera lock

**Tablet (md: 768px)**:
- 3-column photo grids
- Side-by-side project list + detail (iPad split view)
- Wider modals (420px)

**Desktop (lg: 1024px)**:
- 4-column photo grids  
- Three-column layout: projects sidebar + detail + info panel
- Hover states: Subtle card lift, cursor pointer

## PWA Features

- **Install Banner**: Top banner with system blue "Install" button, dismiss icon, reappears weekly
- **Splash Screen**: Pure white with app icon (system blue construction camera) centered, app name below in black
- **App Icon**: Minimal construction camera symbol in system blue, white background, iOS-style mask
- **Offline Mode**: Amber banner notification, cached projects accessible, queue captures for upload
- **Haptics**: Subtle vibration on capture, delete confirmation, project creation

## Accessibility

- **Focus Rings**: 2px system blue outline with 2px white offset
- **Reduced Motion**: Replace all animations with instant state changes, crossfade only
- **VoiceOver**: Descriptive labels for all images ("Site photo, Foundation pour, June 15")
- **Dynamic Type**: All text scales with iOS text size preferences
- **Color Contrast**: WCAG AAA compliance, minimum 7:1 for body text
- **Glove Mode**: All targets 44px minimum, increased spacing in camera controls (56px shutter button)
- **Keyboard Nav**: Full project navigation via Tab, Space to capture, Enter to confirm