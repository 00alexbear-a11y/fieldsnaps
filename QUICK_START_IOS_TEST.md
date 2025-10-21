# Quick Start: Test FieldSnaps on Your iOS Device

This guide helps you quickly test the iOS app on a physical iPhone to verify all the reliability improvements.

## Prerequisites

- **Mac with Xcode 15+** installed
- **iPhone** with USB cable
- **Apple Developer Account** (free account works for testing)

## Step 1: Transfer Files to Your Mac

Download the entire project from Replit to your Mac:

```bash
# Option 1: Git clone (recommended)
git clone <your-replit-git-url>
cd fieldsnaps

# Option 2: Download ZIP from Replit and extract
```

## Step 2: Install Dependencies

```bash
# Install Node dependencies
npm install

# Install CocoaPods (if not already installed)
sudo gem install cocoapods

# Install iOS dependencies
cd ios/App
pod install
cd ../..
```

## Step 3: Open in Xcode

```bash
# Open the iOS project
npx cap open ios
```

This will launch Xcode with your FieldSnaps project.

## Step 4: Configure Signing

1. In Xcode, select the **App** target in the left sidebar
2. Go to **Signing & Capabilities** tab
3. Select your **Team** (Apple Developer account)
4. Xcode will automatically handle the rest

## Step 5: Connect Your iPhone

1. Connect your iPhone via USB cable
2. Unlock your iPhone
3. Trust your Mac (if prompted on iPhone)
4. In Xcode, select your iPhone from the device dropdown (top toolbar)

## Step 6: Build and Run

1. Click the **Play** button (▶️) in Xcode toolbar, or press **⌘R**
2. Xcode will build and install the app on your iPhone
3. First launch might prompt: **"Trust Developer"**
   - Go to iPhone **Settings → General → Device Management**
   - Tap your Apple ID
   - Tap **Trust**

## Step 7: Test the Reliability Improvements

### Camera Reliability Test
1. Open the app on your iPhone
2. Navigate to **Camera** tab
3. **Expected behavior:**
   - Shows clear loading indicator while initializing
   - Camera starts smoothly without crashes
   - If permission denied, shows helpful error with retry button
   - Error messages include clear instructions

### Photo Save Test
1. Take a photo in the app
2. **Expected behavior:**
   - Instant capture with visual feedback
   - Success toast shows "Saved Successfully"
   - If offline, shows appropriate message about syncing later
   - No silent failures - errors are clearly shown

### Edit/Annotation Save Test
1. Take a photo and add annotations (draw, add text, etc.)
2. Save the annotations
3. **Expected behavior:**
   - Loading spinner on black background while processing
   - Success message indicates online/offline status
   - Changes persist after closing and reopening

### Offline Mode Test
1. Enable **Airplane Mode** on your iPhone
2. Navigate around the app
3. **Expected behavior:**
   - Orange banner appears at top: "You're offline..."
   - Can still take photos
   - Can still annotate photos
   - All changes queued for sync
4. Disable Airplane Mode
5. **Expected behavior:**
   - Orange banner disappears
   - Automatic sync occurs in background

## Common Issues

### "Developer Mode Required" (iOS 16+)
- Go to **Settings → Privacy & Security → Developer Mode**
- Enable it and restart iPhone

### Camera Not Working
- Check that camera permission was granted
- Go to **Settings → FieldSnaps → Camera → Allow**

### Build Failed
- Run `pod install` in the `ios/App` directory
- Clean build: **Product → Clean Build Folder** (⌘⇧K)
- Try again

## What to Test

✅ **Critical User Flows:**
- [ ] Camera opens without errors
- [ ] Photos save successfully
- [ ] Annotations save correctly
- [ ] Offline mode shows banner
- [ ] Sync works after coming back online
- [ ] Error messages are helpful and actionable
- [ ] Loading states are clear and professional
- [ ] No crashes during normal usage

## Expected Results

Based on the reliability improvements:

1. **Clear Loading States**: Spinner with visual feedback, not blank screens
2. **Helpful Error Messages**: Every error includes what to do next
3. **Offline Awareness**: Orange banner clearly shows when offline
4. **Consistent Timing**: Success toasts ~2s, errors ~4-5s
5. **Graceful Failures**: Local saves succeed even if sync fails

## Next Steps

If everything works well:
- Ready for TestFlight beta testing
- Can proceed with App Store submission
- Consider setting up Capgo for OTA updates

If issues occur:
- Check Xcode console for error messages
- Take screenshots of any problems
- Report back with specific steps to reproduce

---

**Quick Command Reference:**

```bash
# Rebuild after code changes
npm run build && npx cap sync ios && npx cap open ios

# Just sync assets (faster)
npx cap copy ios

# Open in Xcode
npx cap open ios

# Check configuration
npx cap doctor
```

Good luck with testing! 🚀
