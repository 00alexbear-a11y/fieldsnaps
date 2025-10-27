# ASWebAuth Plugin Registration Steps

## Problem
The `ASWebAuthPlugin.swift` file exists but returns `UNIMPLEMENTED` because it's not registered with Capacitor. This means the Xcode project doesn't know about the plugin.

## Solution: Register the Plugin in Xcode

### Step 1: Open Xcode Project
```bash
cd ~/Documents/Projects/FieldSnaps
open ios/App/App.xcworkspace
```
**Important:** Open the `.xcworkspace` file, NOT the `.xcodeproj` file!

### Step 2: Add Plugin to Xcode Target

1. In Xcode, look at the **Project Navigator** (left sidebar)
2. Find `ASWebAuthPlugin.swift` under the `App` folder
3. Select the file
4. In the **File Inspector** (right sidebar), look for "Target Membership"
5. Make sure the **App** checkbox is checked ✅

If you don't see the file:
1. Right-click the `App` folder in Project Navigator
2. Select "Add Files to App..."
3. Navigate to: `ios/App/App/ASWebAuthPlugin.swift`
4. **Important:** Check "Copy items if needed" and ensure "App" target is selected
5. Click "Add"

### Step 3: Sync Capacitor
```bash
cd ~/Documents/Projects/FieldSnaps
npx cap sync ios
```

This command:
- Copies web assets
- Updates native project
- Ensures all plugins are properly linked

### Step 4: Rebuild in Xcode

1. In Xcode, select your iPhone from the device menu (top toolbar)
2. Click the **Play button** (▶️) or press `Cmd + R`
3. Wait for the build to complete
4. The app will install on your iPhone

### Step 5: Test OAuth Flow

On your iPhone:
1. Open FieldSnaps
2. Tap **"Sign In with Replit"**
3. Safari should open with Replit login
4. Tap **"Allow"** to authorize
5. **Safari should automatically dismiss** (this is the key fix!)
6. You should be logged in to FieldSnaps

## What to Expect

### Success ✅
```
[Native OAuth] Initiating authentication
[Native OAuth] ✅ Got authorization URL
[Native OAuth] 🌐 Opening ASWebAuthenticationSession
[Safari opens, you tap Allow]
[Safari auto-dismisses]
[Native OAuth] ✅ Authentication successful
```

### If Still Failing ❌
Check Xcode console for errors. Common issues:
- Plugin still showing UNIMPLEMENTED → File not in target
- Safari doesn't dismiss → Check callback URL scheme in Info.plist
- CORS error → Server issue (not iOS)

## Need Help?

If it still doesn't work:
1. Check Xcode build logs for errors
2. Verify the plugin file is in the App target
3. Try cleaning build folder: Xcode → Product → Clean Build Folder
4. Rebuild: `Cmd + R`

## What This Fixes

**Before:** `{"code":"UNIMPLEMENTED"}` - Capacitor couldn't find the plugin  
**After:** Safari auto-dismisses after OAuth, proper authentication flow works
