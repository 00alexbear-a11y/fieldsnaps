# FieldSnaps iOS Build Guide

## Prerequisites

Before starting, ensure you have:
- macOS with Xcode 15+ installed
- Apple Developer account (Team ID: 9739WWYHQ6)
- CocoaPods installed (`sudo gem install cocoapods`)
- Git repository cloned locally
- Node.js 18+ installed

---

## Step 1: Environment Variables (CRITICAL)

Before building on your Mac, you MUST set the required environment variables. Create a `.env` file in the project root or export them:

```bash
# Required for Supabase Auth
export VITE_SUPABASE_URL="https://pbfuwfzccdmpkmhncyjg.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Required for API calls (production backend URL)
export VITE_API_URL="https://fieldsnaps.com"

# Optional: Google Maps (for admin map features)
export VITE_GOOGLE_MAPS_API_KEY="your-google-maps-key"
```

**Where to get these values:**
- Supabase values: Go to Supabase Dashboard > Settings > API
- API URL: Your production backend URL (or development URL for testing)
- If building from Replit, these are already configured as secrets

**Alternative: Use a .env file:**
```bash
# Create .env file in project root
cat > .env << EOF
VITE_SUPABASE_URL=https://pbfuwfzccdmpkmhncyjg.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://fieldsnaps.com
EOF
```

---

## Step 2: Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url> fieldsnaps
cd fieldsnaps

# Install Node dependencies
npm install

# Build the production bundle (uses environment variables from Step 1)
npm run build

# Sync with iOS
npx cap sync ios
```

---

## Step 3: Install CocoaPods Dependencies

```bash
cd ios/App
pod install
cd ../..
```

This installs all 24 Capacitor plugins including:
- Background Geolocation (TransistorSoft)
- Camera, Geolocation, Haptics
- SecureStorage for auth tokens
- Capgo OTA updates

---

## Step 4: Open in Xcode

```bash
npx cap open ios
```

Or manually open: `ios/App/App.xcworkspace` (NOT `.xcodeproj`)

---

## Step 5: Xcode Configuration

### 5.1 Signing & Capabilities

1. Select **App** target in the project navigator
2. Go to **Signing & Capabilities** tab
3. Set **Team**: Your Apple Developer Team (9739WWYHQ6)
4. Ensure **Bundle Identifier**: `com.fieldsnaps.app`
5. Xcode should auto-create provisioning profiles

### 5.2 Required Capabilities

Add these if not already present:
- **Associated Domains** (for Universal Links - future use)
- **Background Modes**: 
  - Location updates
  - Background fetch
- **Push Notifications** (if enabling in future)

### 5.3 Privacy Descriptions (Already Configured)

Info.plist already includes all required privacy descriptions:
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `NSFaceIDUsageDescription`

---

## Step 6: TransistorSoft License (Background Geolocation)

The TransistorSoft Background Geolocation plugin requires a license for production:

1. Purchase license at: https://shop.transistorsoft.com/
2. In your app initialization code, add the license key (typically in geofencing initialization)

For testing, the plugin works without a license but shows a debug banner.

---

## Step 7: Build and Run

### Simulator Testing
1. Select an iOS simulator (iPhone 14 Pro recommended)
2. Press **Cmd+R** or click the Play button
3. Wait for app to build and launch

### Device Testing
1. Connect your iPhone via USB
2. Select your device in the device dropdown
3. Press **Cmd+R** to build and run
4. Trust the developer profile on your iPhone: Settings > General > VPN & Device Management

---

## Step 8: OAuth Testing

### Google Sign-In
- Should work immediately with Supabase configuration
- Uses `com.fieldsnaps.app://auth/callback` redirect

### Apple Sign-In
- Requires app to be signed with your Apple Developer Team
- Service ID: `com.fieldsnaps.signin`
- Already configured in Supabase

### Supabase Redirect URLs (Already Configured)
Ensure these are in Supabase Dashboard > Authentication > URL Configuration:
- `com.fieldsnaps.app://auth/callback` (native iOS deep link)
- `https://your-production-domain.com/auth/callback` (web)

---

## Common Issues and Solutions

### Issue: "Signing for App requires a development team"
**Solution**: Select your team in Signing & Capabilities

### Issue: "No provisioning profiles found"
**Solution**: Ensure you're logged into Xcode with your Apple ID (Xcode > Preferences > Accounts)

### Issue: OAuth redirects back to Safari instead of app
**Solution**: Verify `CFBundleURLSchemes` in Info.plist contains `com.fieldsnaps.app`

### Issue: White screen on launch
**Solution**: 
1. Check Xcode console for JavaScript errors
2. Ensure `npm run build` was successful
3. Re-run `npx cap sync ios`

### Issue: Location permission not appearing
**Solution**: Clean build (Cmd+Shift+K) and rebuild

### Issue: App crashes immediately
**Solution**: 
1. Check for missing pods: `cd ios/App && pod install`
2. Clean derived data: Xcode > Product > Clean Build Folder

---

## Build for TestFlight/App Store

### 1. Archive the App
1. Select **Any iOS Device** as build target
2. Product > Archive
3. Wait for archive to complete

### 2. Upload to App Store Connect
1. In Organizer, select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Upload

### 3. Submit for Review
1. Go to App Store Connect
2. Select your app
3. Create a new version
4. Fill in release notes
5. Submit for review

---

## Quick Reference

| Item | Value |
|------|-------|
| Bundle ID | `com.fieldsnaps.app` |
| Team ID | `9739WWYHQ6` |
| Apple Service ID | `com.fieldsnaps.signin` |
| Deep Link Scheme | `com.fieldsnaps.app://` |
| Auth Callback | `com.fieldsnaps.app://auth/callback` |
| Min iOS Version | 14.0 |
| Supabase Callback | `https://pbfuwfzccdmpkmhncyjg.supabase.co/auth/v1/callback` |

---

## Current Build Status

- **Production Build**: Ready (npm run build completed)
- **iOS Sync**: Completed (24 plugins registered)
- **Dev Login**: Disabled for production
- **Replit Branding**: Removed

---

## Re-deploying After Changes

When you make code changes:

```bash
# On Replit or your dev machine
npm run build
npx cap sync ios

# Then in Xcode
Cmd+Shift+K  # Clean
Cmd+R        # Build and run
```

---

## Contact

For issues specific to this build configuration, refer to the `replit.md` file for architectural context.
