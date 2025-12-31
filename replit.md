# FieldSnaps - Construction Photo PWA

## Overview
FieldSnaps is an Apple-inspired Progressive Web App (PWA) designed for construction professionals to provide robust offline photo and video documentation. Its primary purpose is to enhance project efficiency, minimize disputes, and streamline organization through instant media capture, smart compression, and auto-timestamping. The project aims to become a commercial SaaS product offering full offline functionality, touch optimization, automatic time tracking with geofencing, and comprehensive timecard export capabilities.

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
The design adopts an Apple-inspired aesthetic, featuring minimalism, clear typography, an 8px grid, fluid animations, haptic feedback, and natural gesture navigation. Components include rounded buttons, subtle shadows, a tab bar with SF Symbols-inspired icons, and a camera interface optimized for one-handed use with frosted glass effects. The design is CSS-first, mobile-first, and responsive, supporting split-screen comparison, unified navigation, and iOS safe areas. Usability is enhanced with Apple-style notification badges, clean form designs, auto-applying date pickers, and context-aware camera UIs.

### Technical Implementations
FieldSnaps is an offline-first PWA leveraging Service Workers, IndexedDB, and the Background Sync API. Performance is optimized with lazy loading and Web Workers for image compression. Media is stored in Replit Object Storage. The camera supports instant capture, video, real-time annotation, session-based photo management, intelligent quota management, and WiFi-only upload controls. Authentication uses Supabase Auth (migrating from Replit Auth) with OpenID Connect and biometric login via SimpleWebAuthn. Capacitor provides a native-like iOS experience, with Capgo for OTA updates. A multi-platform subscription system supports Stripe, Apple In-App Purchase, and Google Play Billing. Key features include a bottom navigation bar, comprehensive camera, a To-Do system with photo attachments, various photo management views, an interactive map, user-scoped project preferences, a timezone-safe time tracking system with Clock In/Out and timesheets, and a "Snap & Speak" camera mode for rapid task creation. Automatic time tracking utilizes geofencing via TransistorSoft Capacitor Background Geolocation, with transparent location privacy explanations and Google Places Autocomplete for address entry.

### System Design Choices
The architecture prioritizes simplicity and an invisible interface. Service Workers manage hourly updates and offline caching. IndexedDB is used for Blob storage, intelligent quota management, and automatic thumbnail cleanup. Performance is optimized through database indexing, query optimization, code-splitting, and virtualization. The offline sync system incorporates queue limits, exponential backoff, atomic deduplication, and persistent failed sync items. Global error notifications are handled by TanStack Query. Production readiness includes React Error Boundaries, consistent empty states, haptic feedback, and robust security headers. Backend optimizations focus on compression, field filtering, upload resilience, per-user rate limiting, and a 3-tier upload system. Critical edge cases like device battery failure while clocked in, overlapping geofences, and low GPS accuracy are addressed. Time tracking includes server-side auto-close for stale sessions, heartbeat tracking, and admin visibility of auto-closed entries. An iOS-optimized keyboard management solution ensures inputs auto-scroll into view. iOS WKWebView `position: fixed` issues are mitigated by ensuring full-screen routes render outside SidebarProvider, header/bottom navigation render via React Portal, `contentInset: 'never'` in Capacitor, removal of `-webkit-overflow-scrolling: touch`, and synchronous safe area initialization.

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
- **Supabase Auth**: Primary authentication provider (Google OAuth, Apple Sign-In, email/password)
  - **@capgo/capacitor-social-login**: For native iOS Google/Apple SDKs authentication
- **Replit Auth**: Legacy authentication
- **SimpleWebAuthn**: WebAuthn/FIDO2 biometric authentication

### Native Platform & OTA Updates
- **Capacitor 6**: Native wrapper for iOS/Android
- **Capgo**: Encrypted over-the-air (OTA) updates

### Capacitor Plugins
- **@capacitor/core**: Core functionality
- **@capacitor/camera**: Native camera integration
- **@capacitor/haptics**: Native haptic feedback
- **@capacitor/keyboard**: Keyboard visibility events for iOS native
- **capacitor-plugin-safe-area**: Real device safe area insets for notches/home indicators
- **@transistorsoft/capacitor-background-geolocation**: Battery-optimized background location tracking and geofencing
- **@transistorsoft/capacitor-background-fetch**: Background task scheduling for location sync
- **@capacitor-community/speech-recognition**: Native speech recognition

### Third-Party APIs & Payment Processing
- **Google Geocoding API**: Address to coordinates conversion
- **Google Maps API**: Map views and location display
- **Stripe**: Web subscription management and payment processing

---

## iOS/Android Native App Fix Gameplan (January 2025)

### Executive Summary
Fix critical bugs preventing FieldSnaps from working on native iOS/Android devices. Primary focus: photos not displaying, UI layout problems, and functional issues.

### Verified Status (From Three-Way Audit)
**Already Implemented (DO NOT REBUILD):**
- ✅ Network status caching and deduplication (`nativeNetwork.ts`)
- ✅ Sync queue size limits (`MAX_QUEUE_SIZE = 500`)
- ✅ Sync queue cleanup called in `syncNow()`
- ✅ IndexedDB offline storage with background sync
- ✅ Virtual scrolling with react-window
- ✅ `getApiUrl()` helper exists in `apiUrl.ts`

---

### Phase 1 Fixes (Critical - Day 1)

#### 🔴 ISSUE #1: Photos Not Displaying (CRITICAL)
**Problem:** Photos show "Connect to internet to view" even when synced. Native apps cannot resolve relative URLs like `/objects/123`.

**Root Cause:** Server returns relative paths. Web browser resolves correctly (same origin), but native Capacitor app has NO origin - relative URLs fail.

**Solution:** Wrap ALL photo URLs with `getApiUrl()`:
```typescript
<LazyImage src={getApiUrl(photo.url)} />
```

**Files to modify:**
- `client/src/components/LazyImage.tsx` - Core image component
- `client/src/pages/ProjectPhotos.tsx` - Photo grid
- `client/src/pages/AllPhotos.tsx` - All photos view  
- `client/src/pages/ToDos.tsx` - Todo attachments

---

#### 🟡 ISSUE #2: CSS Safe Area Variables
**Problem:** Sidebar header height hardcoded to `57px`. Doesn't adapt to device notches.

**Solution:** Add CSS variables to `index.css`:
```css
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --header-height: 57px;
  --bottom-nav-height: 72px;
}
```

---

#### 🟡 ISSUE #3: Sidebar Header Gap
**Problem:** Gap between sidebar header and content doesn't match device safe areas.

**Solution:** Use CSS variable instead of hardcoded 57px:
```typescript
height: calc(var(--safe-area-top) + var(--header-height));
```

---

#### 🟡 ISSUE #4: Red Error Behind Logo
**Problem:** Error states render at full-page height, show behind fixed header.

**Solution:** Add proper padding to error states in ToDos.tsx, Timesheets.tsx

---

#### 🟡 ISSUE #5: Timesheets Not Loading
**Problem:** API calls using relative URLs on native.

**Solution:** Ensure all API calls use `getApiUrl()` and auth headers.

---

#### 🟢 ISSUE #6: Google Re-login Auto-selects
**Status:** ✅ ALREADY FIXED (added `SocialLogin.logout()` to sign out)

---

#### 🟡 ISSUE #7: Profile Photo Not Setting
**Problem:** Upload works but avatar stays as initials (cache not invalidated).

**Solution:** Invalidate queries after upload:
```typescript
queryClient.invalidateQueries({ queryKey: ['/api/user'] });
queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
```

---

### Phase 1 Fixes (Day 1-2 Continued)

#### 🟡 ISSUE #8: Create useKeyboard Hook
**Problem:** Keyboard events not handled properly, platform differences.

**Solution:** Create simplified keyboard hook with platform-specific events:
```typescript
// hooks/useKeyboard.ts
export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    const showEvent = platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = platform === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showListener = Keyboard.addListener(showEvent, (info) => {
      setKeyboardHeight(info.keyboardHeight);
    });
    
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);
  
  return keyboardHeight;
}
```

---

#### 🟡 ISSUE #9: Apply Keyboard Hook to Camera Edit Mode
**Problem:** Bottom toolbar overlaps with text input.

**Solution:** Use `useKeyboard()` hook to adjust padding when keyboard visible.

---

#### 🟡 ISSUE #10: Map View Header Too Large
**Problem:** "Locations" title + toggle take up too much space.

**Solution:** Remove title, compact controls, floating overlay for count.

---

#### 🟡 ISSUE #11: Auth Cancellation Flag
**Problem:** React 18 Strict Mode causes duplicate initialization (minor).

**Solution:** Add cancellation flag:
```typescript
useEffect(() => {
  let cancelled = false;
  const init = async () => {
    if (cancelled) return;
    const { session, user } = await initializeAuth();
    if (cancelled) return;
    setAuthState({ session, supabaseUser: user, isInitialized: true });
  };
  init();
  return () => { cancelled = true; };
}, []);
```

---

#### 🟢 ISSUE #12: Add Global gcTime
**Problem:** Query cache may grow over long sessions.

**Solution:** Add to `queryClient.ts` defaults:
```typescript
gcTime: 10 * 60 * 1000, // 10 minutes
```

---

#### 🟡 ISSUE #13: Verify Memory Leaks
**Problem:** Potential listener leaks in Camera.tsx, PhotoEdit.tsx.

**Solution:** Check for missing cleanup in useEffect hooks.

---

### Phase 2 (Do Last - After Testing)

#### 🔴 ISSUE #14: Re-enable Sentry Safely
**IMPORTANT:** Previous Sentry implementation broke Google login for weeks.

**Solution:** Re-enable with careful configuration:
```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: import.meta.env.PROD && !import.meta.env.VITE_DISABLE_SENTRY,
  environment: Capacitor.isNativePlatform() ? 'mobile' : 'web',
  
  integrations: [
    Sentry.browserTracingIntegration({
      tracePropagationTargets: [/^(?!.*\/api\/auth).*$/], // Exclude auth
    }),
  ],
  
  beforeSend(event) {
    const blocklist = ['did not match expected pattern', 'OAuth callback'];
    if (blocklist.some(msg => event.message?.includes(msg))) return null;
    return event;
  },
});
```

**Testing Protocol:**
1. Build WITHOUT Sentry → Verify login works
2. Enable Sentry → Test login IMMEDIATELY
3. If login breaks → Disable via `VITE_DISABLE_SENTRY=true`

---

### iOS vs Android Platform Differences

| Feature | iOS | Android | Solution |
|---------|-----|---------|----------|
| Safe Area Top | 20-59px (Dynamic Island/notch) | ~24px | `env(safe-area-inset-top)` |
| Safe Area Bottom | ~34px (home indicator) | 0-56px | `env(safe-area-inset-bottom)` |
| Keyboard Events | `keyboardWillShow` | `keyboardDidShow` | Check `Capacitor.getPlatform()` |
| Back Navigation | Swipe gesture | Hardware button | `App.addListener('backButton')` |

---

### Success Criteria
Phase 1 complete when:
- [ ] Photos display in all views on iOS/Android device
- [ ] Camera works without errors
- [ ] Keyboard doesn't cover inputs
- [ ] All API calls succeed
- [ ] No red error toasts
- [ ] UI looks correct on iPhone notch devices
- [ ] Login works 10/10 times