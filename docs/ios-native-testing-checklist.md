# iOS Native Testing Checklist
## Physical Device Testing Requirements for App Store Submission

### Overview
FieldSnaps must be tested on physical iOS devices before App Store submission. This checklist covers gesture interactions, safe area handling, and native-specific features that cannot be validated in a web browser.

**Testing Philosophy**: Thorough native testing catches issues that only appear on real hardware (haptics, geofencing, camera, performance).

---

## Phase 4: Touch Gestures & Haptic Feedback

### Required Test Devices
Minimum required for comprehensive testing:
- **iPhone 15 Pro** (6.1", Dynamic Island, A17 Pro)
- **iPhone 14 Pro** (6.1", Dynamic Island, A16 Bionic)
- **iPhone SE (3rd gen)** (4.7", Home Button, A15 Bionic)

**Why These Models:**
- iPhone 15 Pro: Latest hardware, Dynamic Island
- iPhone 14 Pro: Previous-gen flagship (common in field)
- iPhone SE: Smallest screen, budget model (common among workers)

---

### 1. Tap Gesture Responsiveness

**Objective**: Verify zero tap delay on all interactive elements

| Element Type | Location | Expected Behavior | Pass Criteria |
|--------------|----------|-------------------|---------------|
| Bottom Tab Bar | All 5 tabs | Instant switch (<16ms) | No visual lag |
| Camera Shutter | Camera page | Instant capture | Photo saved immediately |
| Card Buttons | Projects, To-Do | Instant navigation | No hesitation |
| Toggle Switches | Settings | Instant state change | Smooth animation |
| Input Focus | All forms | Keyboard appears <100ms | No delay |

**Test Procedure:**
1. Rapid-tap each tab in bottom navigation (5 taps/second)
2. Take 10 consecutive photos with camera shutter
3. Toggle Location Privacy switch 10 times rapidly
4. Tap 20 project cards in quick succession

**Fail Conditions:**
- ❌ Any perceivable delay (>100ms) before action
- ❌ Double-tap required to trigger action
- ❌ Visual "dead zone" where taps don't register

---

### 2. Swipe Gesture Smoothness

**Objective**: Verify 60fps swipe performance with no jank

| Gesture Type | Location | Expected Behavior | Pass Criteria |
|--------------|----------|-------------------|---------------|
| Photo Swipe (Delete) | Photos list | Smooth reveal of delete button | 60fps, no stutter |
| Horizontal Scroll | Photo gallery | Butter-smooth scrolling | No dropped frames |
| Pull-to-Refresh | Projects list | Smooth elastic animation | No jank |
| Modal Dismiss | Camera, Dialogs | Smooth slide-down | 60fps transition |

**Test Procedure:**
1. Swipe-to-delete 20 photos in rapid succession
2. Scroll through 100+ photo gallery horizontally
3. Pull-to-refresh on Projects page 10 times
4. Open and dismiss camera modal 10 times

**Performance Measurement:**
- Record screen at 60fps slow-motion
- Count dropped frames in swipe animations
- Goal: <1% frame drops

**Fail Conditions:**
- ❌ Visible stuttering during swipe
- ❌ Inconsistent animation speed
- ❌ "Rubber-banding" feels laggy

---

### 3. Haptic Feedback Validation

**Objective**: Verify haptic feedback triggers correctly on all interactions

| Interaction | Haptic Type | Intensity | Timing |
|-------------|-------------|-----------|--------|
| Camera Shutter | Impact Heavy | Strong | On photo capture |
| Clock In | Notification Success | Medium | On successful clock-in |
| Clock Out | Notification Success | Medium | On successful clock-out |
| Delete Photo | Impact Medium | Medium | On swipe-delete confirm |
| Toggle Switch | Selection | Light | On state change |
| Error Toast | Notification Error | Medium | On error display |

**Test Procedure:**
1. Hold phone in hand (not on table - haptics won't transmit)
2. Capture 5 photos - feel for shutter haptic
3. Clock in/out 3 times - feel for success haptic
4. Delete 5 photos - feel for delete haptic
5. Toggle Location Privacy 5 times - feel for switch haptic
6. Trigger error (airplane mode + sync) - feel for error haptic

**Fail Conditions:**
- ❌ No haptic feedback when expected
- ❌ Wrong haptic type (e.g., Selection instead of Impact)
- ❌ Delayed haptic (>50ms after visual feedback)
- ❌ Double-haptic (duplicate triggers)

**Device-Specific Notes:**
- iPhone SE: Taptic Engine less pronounced than Pro models
- iPhone 14/15 Pro: Stronger, crisper haptics

---

### 4. Long-Press Gestures

**Objective**: Verify long-press actions work correctly

| Element | Long-Press Action | Duration | Visual Feedback |
|---------|-------------------|----------|-----------------|
| Photo Card | Show context menu | 500ms | Menu appears |
| Project Card | Show options | 500ms | Menu appears |
| Bottom Tab | None (no action) | - | No feedback |

**Test Procedure:**
1. Long-press photo card - verify context menu appears
2. Long-press project card - verify options appear
3. Long-press tab bar icons - verify no action (expected)

**Fail Conditions:**
- ❌ Long-press doesn't trigger menu
- ❌ Menu appears on tap (should require long-press)
- ❌ Inconsistent trigger duration

---

## Phase 5: Safe Area Handling

### Required Test Scenarios

#### A. Notch/Dynamic Island Compatibility

**iPhone 15 Pro / 14 Pro (Dynamic Island):**
- [ ] Status bar never overlaps Dynamic Island
- [ ] Header content stays below Dynamic Island
- [ ] Camera UI respects Dynamic Island cutout
- [ ] Full-screen photo viewer doesn't clip at top

**iPhone SE (No Notch):**
- [ ] Header aligns to standard status bar height
- [ ] No excessive top padding (should use full screen)

**Visual Checklist:**
```
┌─────────────────────────┐
│  [Dynamic Island/Notch] │ ← No content overlap
├─────────────────────────┤
│   Header / Title Bar   │ ← Safe area respected
│                         │
│   Main Content Area    │
│                         │
└─────────────────────────┘
│   Tab Bar / Buttons    │ ← Safe area respected
└─────────────────────────┘
   [Home Indicator]         ← No content overlap
```

---

#### B. Bottom Safe Area (Home Indicator)

**All iPhones without Home Button (14 Pro, 15 Pro):**
- [ ] Bottom tab bar has padding above home indicator
- [ ] Camera shutter button not hidden by home indicator
- [ ] Floating action buttons clear home indicator by ≥16px
- [ ] Modal sheets leave 34px bottom padding

**Test Procedure:**
1. Open camera - verify shutter button is fully tappable
2. Scroll to bottom of long list - verify last item is visible
3. Open modal - verify dismiss button is fully visible
4. Take photo - verify bottom controls don't overlap indicator

**Fail Conditions:**
- ❌ Home indicator covers interactive elements
- ❌ Bottom content clipped/hidden
- ❌ Last list item partially hidden

**CSS Validation:**
```css
/* Verify this is applied globally */
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

---

#### C. Landscape Mode Safe Areas

**Camera in Landscape:**
- [ ] Shutter button rotates to right side
- [ ] Shutter remains tappable (not in notch area)
- [ ] Grid overlays respect horizontal safe areas
- [ ] Preview doesn't clip at notch sides

**Test Procedure:**
1. Rotate device to landscape
2. Open camera
3. Verify all controls are accessible
4. Take photo and verify it saves correctly

**Device-Specific Testing:**
- iPhone 15 Pro: Dynamic Island on left/right in landscape
- iPhone SE: No safe area issues (full edge-to-edge)

---

#### D. Keyboard Management

**Objective**: Verify inputs scroll into view when keyboard appears

**Test Scenarios:**
| Input Location | Keyboard Appears | Expected Behavior |
|----------------|------------------|-------------------|
| Bottom of screen | Yes | Input scrolls into view |
| Behind tab bar | Yes | Tab bar slides up |
| In modal | Yes | Modal content scrolls |

**Test Procedure:**
1. Open "Create Project" form
2. Tap address input (near bottom)
3. Verify: Input scrolls into view, keyboard doesn't cover it
4. Tap description (long text area)
5. Verify: Text area fully visible above keyboard

**Fail Conditions:**
- ❌ Input hidden behind keyboard
- ❌ Content doesn't scroll when keyboard appears
- ❌ Tab bar covers input

---

## Phase 5 (Continued): Native Feature Testing

### 5. Camera & Media Integration

**Camera Capture:**
- [ ] Rear camera captures photo without crash
- [ ] Front camera (selfie) captures photo
- [ ] Flash toggle works (on supported devices)
- [ ] Grid overlay displays correctly
- [ ] Photo orientation correct (portrait/landscape)

**Photo Library Access:**
- [ ] "Save to Photos" saves to camera roll
- [ ] Photos appear in iOS Photos app
- [ ] EXIF data preserved (timestamp, location)

**Permission Prompts:**
- [ ] Camera permission prompt on first launch
- [ ] "Don't Allow" → graceful error message
- [ ] "Allow" → camera works immediately

---

### 6. Geofencing & Background Location

**Location Permission Flow:**
- [ ] "Allow While Using App" prompt on first launch
- [ ] "Allow Always" prompt appears after initial "While Using"
- [ ] Blue status bar indicator appears when tracking
- [ ] Geofence triggers when entering test location

**Background Tracking:**
- [ ] App sends clock-in notification when entering geofence
- [ ] Notification works when app is closed
- [ ] Notification works when phone is locked
- [ ] Tapping notification opens app and clocks in

**Battery Impact:**
- [ ] <10% battery drain over 8-hour shift
- [ ] GPS turns off when stationary >5 min
- [ ] No excessive CPU usage (check Settings → Battery)

**Test Locations:**
- Create geofence for test address (e.g., your home)
- Drive/walk to location
- Verify notification appears
- Tap notification and verify clock-in

---

### 7. Offline Functionality

**Network Conditions:**
| Scenario | Expected Behavior | Pass Criteria |
|----------|-------------------|---------------|
| Airplane Mode | Photos save locally | Sync icon appears |
| WiFi Only (No cellular) | App loads cached data | No errors |
| Slow 3G | Photos queue for upload | Progress indicator |
| Network restored | Queued items sync | Upload completes |

**Test Procedure:**
1. Enable Airplane Mode
2. Take 5 photos
3. Verify photos saved to IndexedDB
4. Create new To-Do task
5. Disable Airplane Mode
6. Verify auto-sync starts within 10 seconds
7. Verify all 5 photos upload successfully

**Fail Conditions:**
- ❌ App crashes in offline mode
- ❌ Photos lost when coming back online
- ❌ Sync never triggers after reconnection

---

### 8. iOS Notifications

**Local Notifications:**
- [ ] Clock-in notification appears (geofence entry)
- [ ] Clock-out notification appears (geofence exit)
- [ ] Notification banner displays correctly
- [ ] Sound plays (if enabled)
- [ ] Badge count updates (if applicable)

**Notification Actions:**
- [ ] Tap notification body → app opens
- [ ] Notification appears on lock screen
- [ ] Notification appears in notification center
- [ ] Long-press shows notification preview

**Permission Handling:**
- [ ] Notification permission prompt on first launch
- [ ] "Don't Allow" → graceful degradation (no crash)
- [ ] "Allow" → notifications work immediately

---

## Phase 6: Native vs Web Parity Testing

### Feature Parity Matrix

| Feature | Web | iOS Native | Status |
|---------|-----|------------|--------|
| Login (Replit Auth) | ✅ Works | ✅ Works | PASS |
| Photo Capture | ❌ Limited | ✅ Full | Native-only |
| Geofencing | ❌ No | ✅ Yes | Native-only |
| Offline Storage | ✅ IndexedDB | ✅ IndexedDB | PASS |
| Push Notifications | ❌ No | ✅ Local | Native-only |
| Haptic Feedback | ❌ No | ✅ Yes | Native-only |
| Camera Flash | ❌ No | ✅ Yes | Native-only |

**Test Strategy:**
1. Test all features in web browser first
2. Deploy to TestFlight
3. Test same features on iOS
4. Document differences in capabilities

---

## Performance Benchmarks

### Target Metrics (iOS Native)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| App Launch Time | <2 seconds | Tap icon → home screen visible |
| Camera Open Time | <500ms | Tap camera tab → viewfinder visible |
| Photo Capture Time | <200ms | Tap shutter → photo saved |
| List Scroll FPS | 60fps | Record at 120fps, count frames |
| Memory Usage | <150MB | Xcode Instruments |
| Battery Drain | <10%/8hr | Settings → Battery |

**Test Procedure:**
1. Install app on clean device (factory reset recommended)
2. Use app normally for 1 hour
3. Record metrics in spreadsheet
4. Compare against targets

---

## TestFlight Deployment Workflow

### 1. Build Archive in Xcode

```bash
# Sync Capacitor
cd ~/workspace
npx cap sync ios

# Open in Xcode
cd ios/App
open App.xcworkspace

# In Xcode:
# 1. Select "Any iOS Device (arm64)" as destination
# 2. Product → Archive
# 3. Wait for build to complete (~5-10 minutes)
```

### 2. Upload to App Store Connect

```
1. Xcode Organizer opens automatically after archive
2. Click "Distribute App"
3. Select "App Store Connect"
4. Select "Upload"
5. Check "Include bitcode" (optional)
6. Click "Upload"
7. Wait for processing (~15 minutes)
```

### 3. Add TestFlight Testers

```
1. Go to App Store Connect → TestFlight
2. Click "Internal Testing" or "External Testing"
3. Add test users by email
4. Users receive TestFlight invite email
5. Testers install TestFlight app from App Store
6. Testers redeem code and install FieldSnaps
```

### 4. Beta Testing Feedback

**Collect from testers:**
- [ ] App crashes or freezes
- [ ] Features that don't work as expected
- [ ] UI elements that feel slow or unresponsive
- [ ] Battery drain concerns
- [ ] Geofencing accuracy issues

**Test Duration:**
- Minimum: 1 week of daily use
- Recommended: 2 weeks with 3+ field workers

---

## Pre-Submission Validation

### Final Checklist (Before App Store Submission)

#### Code & Assets
- [ ] No console.log() in production code
- [ ] All API keys in environment variables
- [ ] App icons all sizes included (1024x1024, 512x512, etc.)
- [ ] Launch screen displays correctly
- [ ] No placeholder text ("Lorem ipsum", "TODO", etc.)

#### Compliance
- [ ] Privacy Policy URL active and accessible
- [ ] Terms of Service URL active and accessible
- [ ] All Info.plist privacy descriptions accurate
- [ ] Location tracking framed as worker benefit (not employer monitoring)
- [ ] TransistorSoft license key added to Info.plist

#### Testing
- [ ] Tested on 3+ physical devices
- [ ] All gestures work smoothly (60fps)
- [ ] Safe areas respected on all screens
- [ ] Haptic feedback works correctly
- [ ] Geofencing tested in real-world scenario
- [ ] Offline mode tested (Airplane Mode)
- [ ] Battery drain <10% over 8 hours

#### App Store Assets
- [ ] 5 screenshots uploaded (see App Store Review Strategy)
- [ ] Demo video uploaded (see Demo Video Script)
- [ ] App description emphasizes worker benefits
- [ ] Keywords optimized for discovery
- [ ] App Review Notes filled out with test account

---

## Common Issues & Fixes

### Issue: Tap Delay on Buttons
**Symptom**: 300ms delay before tap registers  
**Cause**: CSS `-webkit-tap-highlight-color` not set  
**Fix**:
```css
* {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
```

### Issue: Content Hidden Behind Notch
**Symptom**: Header text overlaps Dynamic Island  
**Cause**: Missing `safe-area-inset-top`  
**Fix**:
```css
.header {
  padding-top: env(safe-area-inset-top);
}
```

### Issue: Home Indicator Covers Bottom Button
**Symptom**: Camera shutter partially hidden  
**Cause**: Missing `safe-area-inset-bottom`  
**Fix**:
```css
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Issue: Keyboard Hides Input
**Symptom**: Text input hidden when keyboard appears  
**Cause**: No auto-scroll on input focus  
**Fix**: Use `MobileDialog` component with `useKeyboardManager` hook

### Issue: Geofence Not Triggering
**Symptom**: No clock-in notification at job site  
**Cause**: Location permission not "Always Allow"  
**Fix**: Request "Always Allow" permission, check Settings → Privacy → Location

### Issue: Haptics Not Working
**Symptom**: No vibration on camera shutter  
**Cause**: Haptics disabled in iPhone Settings  
**Fix**: Settings → Sounds & Haptics → System Haptics → ON

---

## Sign-Off Criteria

Before submitting to App Store, verify:

✅ **Phase 4 Complete:**
- All tap gestures feel instant (<100ms)
- All swipe gestures run at 60fps
- All haptic feedback triggers correctly
- Long-press gestures work as expected

✅ **Phase 5 Complete:**
- Safe areas respected on all iPhone models
- Keyboard never hides inputs
- Camera works in portrait and landscape
- Geofencing triggers correctly in background
- Offline mode saves data and syncs when online

✅ **Phase 6 Complete:**
- Native features work (camera, geofencing, haptics)
- Performance meets benchmarks
- Battery drain <10% over 8 hours
- TestFlight beta tested for 1+ week

**Final Approval**: Once all checkboxes are ✅, FieldSnaps is ready for App Store submission.

---

**Document Version**: 1.0  
**Last Updated**: November 19, 2025  
**Status**: Ready for native device testing
