# iOS Development Setup Guide

This guide explains how to run FieldSnaps iOS app connected to your Replit development server.

## ✅ Current Configuration

Your iOS app is configured to connect to:
```
https://b031dd5d-5c92-4902-b04b-e2a8255614a2-00-1nc5d7i5pn8nb.picard.replit.dev
```

## 🚀 Steps to Run iOS App with Backend Connection

### Step 1: Ensure Dev Server is Running
The dev server must be running in Replit (it starts automatically with the "Start application" workflow).

### Step 2: Build the Web App
```bash
npm run build
```

### Step 3: Sync with Capacitor (Dev Mode)
```bash
npx cap sync ios --config capacitor.config.dev.ts
```

### Step 4: Open in Xcode
```bash
npx cap open ios
```

### Step 5: Run in Xcode
- Click the **Play** button in Xcode to run on simulator or device
- The app will now connect to your Replit backend server
- All buttons (Dev Login, Sign In, etc.) will work!

## 🔍 How It Works

When using `capacitor.config.dev.ts`:
- The iOS app loads from the Replit server
- All API calls (like `/api/dev-login`) work because they go to the real backend
- You can test the full authentication flow
- Changes to frontend code require rebuilding and syncing

## 🟠 Dev Login Workflow

1. Click the orange "Dev Login (Simulator)" button
2. App navigates to `/api/dev-login` on your Replit server
3. Backend creates a dev session with credentials:
   - User ID: `dev-user-local`
   - Email: `dev@fieldsnaps.local`
4. Redirects back to the app's home page
5. You're logged in and can test all features!

## 📝 Important Notes

- **Production builds**: 
  - Use the regular `capacitor.config.ts` (no server URL)
  - Update `SERVER_URL` constant in `client/src/lib/nativeNavigation.ts` to your production URL
  - Set `ENABLE_DEV_LOGIN_IN_NATIVE = false` in `client/src/config/devMode.ts`
- **Server URL configuration**: The `SERVER_URL` in `client/src/lib/nativeNavigation.ts` must match the server URL in your Capacitor config
- **Testing changes**: After code changes, rebuild and sync again
- **Network required**: Your Mac and Replit must both have internet access

## 🔗 Deep Linking Configuration (Required for OAuth)

The native iOS app uses deep linking to handle OAuth callbacks. When running `npx cap sync`, Capacitor will automatically configure most of this, but you may need to verify the setup in Xcode.

### What Capacitor Configures Automatically

When you run `npx cap sync`, it updates `ios/App/App/Info.plist` with:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.fieldsnaps.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.fieldsnaps.app</string>
    </array>
  </dict>
</array>
```

This allows iOS to redirect URLs like `com.fieldsnaps.app://callback` back to your app.

### Verifying the Configuration

1. After running `npx cap sync`, open the project in Xcode:
   ```bash
   npx cap open ios
   ```

2. In Xcode, select the **App** target (top-left)
3. Go to the **Info** tab
4. Under **URL Types**, verify there's an entry with:
   - **Identifier**: `com.fieldsnaps.app`
   - **URL Schemes**: `com.fieldsnaps.app`

If this entry is missing, Capacitor didn't sync it properly. You can add it manually in Xcode using the **+** button under URL Types.

### How OAuth Works with Deep Links

1. User clicks "Sign In" → App opens Safari via Browser plugin
2. User authenticates in Safari
3. Server redirects to `com.fieldsnaps.app://callback?code=...`
4. iOS recognizes the URL scheme and opens your app
5. App captures the callback and completes login

## 🐛 Troubleshooting

**Buttons still don't work?**
- Verify the dev server is running in Replit
- Check Xcode console for network errors
- Make sure you synced with `--config capacitor.config.dev.ts`

**App crashes with "Signal 9"?**
- This is usually a memory issue during development
- Try: Clean build folder in Xcode (Cmd+Shift+K)
- Try: Restart Xcode and simulator

**Can't reach Replit server?**
- Verify the URL works in your browser
- Check your firewall settings
- Try restarting the dev server in Replit
