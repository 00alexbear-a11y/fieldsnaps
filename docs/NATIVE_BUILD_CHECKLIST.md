# FieldSnaps Native App Build & Deployment Checklist

## Critical Environment Variable Requirements

Native Capacitor apps bundle environment variables at BUILD time, not runtime.  
**VITE_API_URL must be set BEFORE running `npm run build`.**

### Required Variables for Native Builds

Create a `.env.native` file (or set in terminal before build):

```bash
# REQUIRED: Backend API URL (absolute URL for native platform)
VITE_API_URL=https://fieldsnaps.replit.app

# REQUIRED: Supabase credentials
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# OPTIONAL: Google Maps (for map features)
VITE_GOOGLE_MAPS_API_KEY=<your-google-maps-key>
```

## Step-by-Step Build Process

### 1. Prepare Environment

```bash
# On your Mac, navigate to project
cd /Users/bearmac/Documents/Projects/FieldSnaps

# Ensure git is clean and up-to-date
git status
git pull origin main

# If you see a git lock error:
rm -f .git/index.lock
git pull origin main
```

### 2. Export Environment Variables

```bash
# Option A: Source from file
export $(cat .env.native | xargs)

# Option B: Export individually
export VITE_API_URL=https://fieldsnaps.replit.app
export VITE_SUPABASE_URL=<your-url>
export VITE_SUPABASE_ANON_KEY=<your-key>
```

### 3. Build the Web App

```bash
# Clean previous build artifacts
rm -rf dist

# Run production build (VITE_* vars get baked in here!)
npm run build

# Verify the build succeeded
ls -la dist/
```

### 4. Sync to iOS

```bash
# Copy web assets to iOS project
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### 5. Xcode Build

1. Select your target device (real device or simulator)
2. Product → Clean Build Folder (Cmd + Shift + K)
3. Product → Build (Cmd + B)
4. Product → Run (Cmd + R)

### 6. Verify in Xcode Console

Look for these diagnostic logs on app startup:

```
[API] Native platform: ios
[API] VITE_API_URL: https://fieldsnaps.replit.app
```

If you see:
```
[API] CRITICAL: VITE_API_URL not baked into build! API calls will fail.
```

Then VITE_API_URL was not set before the build. Go back to step 2.

## Common Issues & Solutions

### Issue: "Operation timed out" on photo loads

**Cause**: Object Storage proxy is slow or network is poor.

**Diagnosis**: Check server logs for timing:
```
[PhotoProxy] Thumb abc1234... auth:50ms storage:2500ms total:2600ms
```

If storage time is >2000ms, the issue is Object Storage latency.

**Solutions**:
1. Use WiFi instead of cellular
2. Photos will load eventually (iOS may retry)
3. Reduce image sizes during capture

### Issue: API calls return HTML instead of JSON

**Cause**: VITE_API_URL not set during build.

**Diagnosis**: In Xcode console look for:
```
[API] VITE_API_URL: (not set)
```

**Solution**: Re-run build with environment variables set.

### Issue: Slide-out menu positioned incorrectly

**Cause**: Safe area insets not applied.

**Diagnosis**: Check Xcode console for:
```
[SafeArea] CSS variables set: { top: "59px", bottom: "34px" }
```

If you see `top: "0px"`, the SafeArea plugin failed.

### Issue: Authentication fails silently

**Cause**: Supabase credentials missing.

**Diagnosis**: Look for:
```
[Supabase] Error: supabase URL or anon key not found
```

**Solution**: Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set before build.

## Quick Commands Reference

```bash
# Full rebuild from scratch
rm -rf dist ios/App/App/public
export VITE_API_URL=https://fieldsnaps.replit.app
npm run build
npx cap sync ios
npx cap open ios
```

## Architecture Notes

### Why Absolute URLs for Native?

On native platforms, the app runs from `capacitor://localhost`.  
Relative URLs like `/api/users` resolve to `capacitor://localhost/api/users`.  
This serves the bundled `index.html` instead of calling your API!

The `getApiUrl()` wrapper in `client/src/lib/apiUrl.ts` detects the platform and prepends `VITE_API_URL` on native builds.

### CORS Configuration

The server allows these origins:
- `capacitor://localhost` (iOS)
- `http://localhost` (Android)
- `https://fieldsnaps.replit.app` (production web)

### Photo Proxy Routes

Photos are served through proxy routes instead of direct Object Storage URLs to avoid CORS issues:
- `/api/photos/:id/image` - Full size image
- `/api/photos/:id/thumbnail` - 200x200 thumbnail

These routes have timing logs to help diagnose slow loads.
