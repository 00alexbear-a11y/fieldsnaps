# FieldSnaps iOS Build Guide

This guide walks you through building FieldSnaps as a native iOS app for App Store submission.

## Prerequisites

### Required Tools
- **macOS** with Xcode 15 or later
- **Node.js** 18+ and npm
- **CocoaPods** (install via: `sudo gem install cocoapods`)
- **Apple Developer Account** ($99/year)
- **Xcode Command Line Tools**: `xcode-select --install`

### Recommended
- **Capgo Account** for OTA updates (https://capgo.app)
- **Physical iOS Device** for testing (recommended over simulator)

## Step 1: Clone and Setup

```bash
# Clone your repository
git clone <your-repo-url>
cd fieldsnaps

# Install dependencies
npm install

# Build the web app
npm run build
```

## Step 2: Initialize iOS Project

```bash
# Add iOS platform (first time only)
npx cap add ios

# This creates the ios/ directory with Xcode project
```

## Step 3: Sync Web Assets to iOS

```bash
# Sync built web app to iOS project
npx cap sync ios

# Or use copy for faster sync without plugin updates
npx cap copy ios
```

## Step 4: Add Privacy Manifest to Xcode

1. Open Xcode project:
   ```bash
   npx cap open ios
   ```

2. In Xcode, navigate to `App` target in project navigator

3. Right-click on `App` folder → **Add Files to "App"**

4. Select the `PrivacyInfo.xcprivacy` file from your project root

5. Ensure these settings:
   - ✅ Copy items if needed
   - ✅ Add to targets: App
   - Click **Add**

6. Verify the file appears in **Build Phases** → **Copy Bundle Resources**

## Step 5: Configure Info.plist Permissions

Add these permission descriptions to `ios/App/App/Info.plist`:

```xml
<!-- Camera Access -->
<key>NSCameraUsageDescription</key>
<string>FieldSnaps needs camera access to capture photos and videos for construction documentation.</string>

<!-- Photo Library (for manual uploads) -->
<key>NSPhotoLibraryUsageDescription</key>
<string>FieldSnaps needs photo library access to let you upload existing photos to projects.</string>

<!-- Location (for project geolocation) -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>FieldSnaps uses your location to tag photos with project locations for better organization.</string>

<!-- Face ID / Touch ID (for biometric login) -->
<key>NSFaceIDUsageDescription</key>
<string>FieldSnaps uses Face ID to securely authenticate your account.</string>
```

## Step 6: Configure App Signing

1. In Xcode, select the **App** target

2. Go to **Signing & Capabilities** tab

3. Set your **Team** (Apple Developer account)

4. Set **Bundle Identifier**: `com.fieldsnaps.app`
   - Must match `appId` in `capacitor.config.ts`
   - Must be unique in App Store

5. Enable **Automatically manage signing**

6. Select appropriate **Provisioning Profile**

## Step 7: Set Up Capgo (Optional but Recommended)

### Create Capgo Account

1. Sign up at https://capgo.app

2. Install Capgo CLI globally:
   ```bash
   npm install -g @capgo/cli
   ```

3. Login to Capgo:
   ```bash
   npx @capgo/cli login
   ```

4. Initialize your app:
   ```bash
   npx @capgo/cli app add
   ```

### Configure Encryption

1. Generate encryption keys:
   ```bash
   npx @capgo/cli key create
   ```

2. Add keys to Xcode:
   - In Xcode, go to **Build Settings**
   - Add **User-Defined Settings**:
     - `CAPGO_KEY`: Your generated key
     - `CAPGO_APP_ID`: Your Capgo app ID

3. Update `capacitor.config.ts` with your Capgo settings

## Step 8: Build Configuration

### Development Build

1. Select **Any iOS Device** or your connected device as build target

2. Set Build Configuration to **Debug**

3. Click **Product** → **Build** (⌘B)

4. Test on device: **Product** → **Run** (⌘R)

### Production Build

1. Select **Any iOS Device (arm64)** as build target

2. Set Build Configuration to **Release**

3. Update version numbers:
   - **Version**: User-facing version (e.g., 1.0.0)
   - **Build**: Incremental build number (e.g., 1, 2, 3...)

4. Create Archive: **Product** → **Archive**

## Step 9: App Store Submission

### Prepare App Store Connect

1. Go to https://appstoreconnect.apple.com

2. Create new app:
   - **Name**: FieldSnaps
   - **Primary Language**: English
   - **Bundle ID**: com.fieldsnaps.app
   - **SKU**: fieldsnaps-ios

3. Fill in App Information:
   - **Category**: Productivity / Business
   - **Content Rights**: Original content
   - **Age Rating**: 4+

4. Add **Privacy Policy URL**: https://fieldsnaps.app/privacy
   - Upload `PRIVACY_POLICY.md` to your website first

5. Configure **App Privacy**:
   - Data Collection: See privacy manifest
   - Third-Party SDKs: Stripe, Google Maps, Capgo

### Upload Build

1. In Xcode Organizer, select your archive

2. Click **Distribute App**

3. Select **App Store Connect**

4. Choose **Upload**

5. Select signing options:
   - ✅ Upload your app's symbols
   - ✅ Manage Version and Build Number

6. Review and upload

### Submit for Review

1. In App Store Connect, go to your app

2. Select **App Store** tab

3. Fill in metadata:
   - **App Preview and Screenshots** (required)
   - **Description** and **Keywords**
   - **Support URL** and **Marketing URL**
   - **Promotional Text**

4. Add **Build** (the one you just uploaded)

5. Fill in **App Review Information**:
   - Contact information
   - Demo account credentials (if needed)
   - Notes for reviewer

6. Click **Submit for Review**

## Step 10: Deploy Updates with Capgo

After initial App Store approval, use Capgo for instant updates:

```bash
# Build web app
npm run build

# Upload to Capgo
npx @capgo/cli bundle upload

# Deploy to channel (e.g., production)
npx @capgo/cli channel set production --bundle latest
```

Updates are pushed instantly to users without App Store review (for bug fixes and content updates only).

## Common Build Commands

```bash
# Full rebuild workflow
npm run build && npx cap sync ios && npx cap open ios

# Quick sync after code changes
npx cap copy ios

# Open iOS project in Xcode
npx cap open ios

# Check Capacitor configuration
npx cap doctor

# Update Capacitor dependencies
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/ios@latest

# View device logs
npx cap run ios --target="<device-id>" --livereload
```

## Troubleshooting

### Build Errors

**Error: "Code signing is required"**
- Solution: Set your Team in Signing & Capabilities

**Error: "Bundle identifier already in use"**
- Solution: Change `appId` in `capacitor.config.ts` to something unique

**Error: "Privacy manifest missing"**
- Solution: Follow Step 4 to add `PrivacyInfo.xcprivacy`

### Runtime Issues

**Camera not working**
- Check `Info.plist` has `NSCameraUsageDescription`
- Verify camera permissions in iOS Settings

**Sync failing**
- Check network connectivity
- Verify API endpoints are accessible
- Check browser console for errors

**App crashes on launch**
- Check Xcode console for crash logs
- Verify all Capacitor plugins are installed
- Run `npx cap sync ios` again

### Capgo Issues

**Updates not downloading**
- Verify Capgo API key is correct
- Check app has internet connectivity
- Review Capgo dashboard for update status

**Encryption errors**
- Regenerate encryption keys: `npx @capgo/cli key create`
- Ensure keys match between Xcode and Capgo dashboard

## Testing Checklist

Before submitting to App Store:

- [ ] Camera capture works (photo and video)
- [ ] Photos upload and sync correctly
- [ ] Offline mode functions properly
- [ ] Project creation and management works
- [ ] To-do system creates and assigns tasks
- [ ] PDF export generates correctly
- [ ] Map view shows project locations
- [ ] Stripe subscription works
- [ ] Biometric login functions
- [ ] App doesn't crash on background/foreground
- [ ] Privacy manifest is included
- [ ] All permissions are properly requested
- [ ] App works on multiple iOS versions (test iOS 15+)
- [ ] Landscape and portrait modes work
- [ ] iPad layout is acceptable
- [ ] Performance is smooth (no lag)

## App Store Guidelines

Ensure compliance with Apple's guidelines:

- ✅ Provide value beyond a website wrapper
- ✅ Don't use analytics SDKs that violate privacy rules
- ✅ Follow Human Interface Guidelines
- ✅ Support latest iOS version
- ✅ Work on all required devices
- ✅ Include clear privacy policy
- ✅ Don't collect data without consent
- ✅ OTA updates only change web content (not native code)

## Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Capgo Docs**: https://capgo.app/docs
- **Apple Developer**: https://developer.apple.com
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Privacy Manifest**: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files

## Support

For help with FieldSnaps iOS build:
- **Email**: support@fieldsnaps.app
- **Documentation**: https://fieldsnaps.app/docs

---

**Good luck with your App Store submission! 🚀**
