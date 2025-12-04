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

# Required for Native Google Sign-In (see Step 8)
export VITE_GOOGLE_WEB_CLIENT_ID="your-google-web-client-id.apps.googleusercontent.com"

# Optional: Google Maps (for admin map features)
export VITE_GOOGLE_MAPS_API_KEY="your-google-maps-key"
```

**Where to get these values:**
- Supabase values: Go to Supabase Dashboard > Settings > API
- API URL: Your production backend URL (or development URL for testing)
- Google Web Client ID: Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > Web application
- If building from Replit, these are already configured as secrets

**Alternative: Use a .env file:**
```bash
# Create .env file in project root
cat > .env << EOF
VITE_SUPABASE_URL=https://pbfuwfzccdmpkmhncyjg.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://fieldsnaps.com
VITE_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
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

## Step 8: Native Authentication Setup

The app uses native SDKs for Google and Apple Sign-In on iOS, then passes ID tokens to Supabase for authentication. This approach bypasses browser-based OAuth issues on iOS.

### 8.1 Google Sign-In Setup (REQUIRED)

1. **Get Google OAuth Client IDs** from Google Cloud Console:
   - Go to: https://console.cloud.google.com/apis/credentials
   - You need TWO OAuth 2.0 Client IDs:
     - **Web application** - Already configured: `757835035018-7ilv1jh3as4lu0v5revucs3ku0h6csqe.apps.googleusercontent.com`
     - **iOS** - Create new one with Bundle ID: `com.fieldsnaps.app`
   
2. **Create iOS OAuth Client ID** (if not already done):
   - In Google Cloud Console, click "+ CREATE CREDENTIALS" > "OAuth client ID"
   - Application type: "iOS"
   - Bundle ID: `com.fieldsnaps.app`
   - App Store ID: (leave empty for now)
   - Team ID: `9739WWYHQ6`
   - Click "Create"
   - Note the iOS Client ID (format: `XXXX.apps.googleusercontent.com`)

3. **Add iOS URL Scheme** to `ios/App/App/Info.plist`:
   - In Google Cloud Console, click on your iOS OAuth client
   - Copy the "iOS URL scheme" (format: `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID`)
   - Add to Info.plist inside `CFBundleURLTypes` array (after the existing `com.fieldsnaps.app` scheme):
   
   ```xml
   <dict>
       <key>CFBundleURLName</key>
       <string>google-signin</string>
       <key>CFBundleURLSchemes</key>
       <array>
           <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
       </array>
   </dict>
   ```

4. **Web Client ID** is already configured:
   - Environment variable `VITE_GOOGLE_WEB_CLIENT_ID` is set in Replit
   - When building locally, export it: `export VITE_GOOGLE_WEB_CLIENT_ID="757835035018-7ilv1jh3as4lu0v5revucs3ku0h6csqe.apps.googleusercontent.com"`

5. **Verify Supabase Configuration**:
   - Go to Supabase Dashboard > Authentication > Providers > Google
   - Ensure the Web Client ID and Secret are configured
   - The same Web Client ID should be used in both Supabase and the app

### 8.2 Apple Sign-In Setup (REQUIRED)

1. **Enable Sign in with Apple capability** in Xcode:
   - Select App target > Signing & Capabilities
   - Click "+ Capability"
   - Add "Sign in with Apple"

2. **Verify Apple Developer Configuration**:
   - App ID: `com.fieldsnaps.app` must have "Sign in with Apple" enabled
   - Service ID: `com.fieldsnaps.signin` (for web authentication)
   
3. **Supabase Apple Configuration** (Already done):
   - Service ID: `com.fieldsnaps.signin`
   - Team ID: `9739WWYHQ6`
   - Key ID: `7AB24X9GC4`

### 8.3 How It Works

The native authentication flow:
1. User taps "Sign in with Google/Apple"
2. Native SDK presents sign-in UI (not a browser)
3. User authenticates with their account
4. SDK returns an ID token
5. App passes ID token to Supabase via `signInWithIdToken()`
6. Supabase verifies the token and creates/links user account

### 8.4 Testing OAuth

**Google Sign-In:**
- Tap "Sign in with Google" button
- Native Google Sign-In sheet should appear
- Select your Google account
- App should authenticate and redirect to home

**Apple Sign-In:**
- Tap "Sign in with Apple" button
- Face ID / Touch ID prompt appears
- Approve with biometrics
- App should authenticate and redirect to home

### 8.5 Troubleshooting

**"No ID token returned":**
- Check that Web Client ID is set correctly in environment
- Verify iOS URL scheme is added to Info.plist
- Ensure you rebuilt after adding env vars: `npm run build && npx cap sync ios`

**Google Sign-In sheet doesn't appear:**
- Verify `com.googleusercontent.apps.XXX` URL scheme in Info.plist
- Check Xcode console for initialization errors

**Apple Sign-In fails:**
- Ensure "Sign in with Apple" capability is added
- Verify provisioning profile includes Sign in with Apple
- Check that app is signed with correct team

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
| Auth Callback (Legacy) | `com.fieldsnaps.app://auth/callback` |
| Auth Method | Native SDK + signInWithIdToken |
| Min iOS Version | 14.0 |
| Supabase Callback | `https://pbfuwfzccdmpkmhncyjg.supabase.co/auth/v1/callback` |
| Google Web Client ID | Set via `VITE_GOOGLE_WEB_CLIENT_ID` env var |
| Required Capabilities | Sign in with Apple, Background Modes (location, fetch) |

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
