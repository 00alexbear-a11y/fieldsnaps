# TransistorSoft Background Geolocation License Setup
## iOS Production Deployment Guide

### Overview
FieldSnaps uses `@transistorsoft/capacitor-background-geolocation` for battery-optimized background location tracking and geofencing. **An iOS production license is required** for App Store deployment.

---

## License Information

### Product
- **Name**: Capacitor Background Geolocation - iOS License
- **Vendor**: TransistorSoft Software Inc.
- **License Type**: One-time purchase (perpetual)
- **Cost**: $399 USD (as of November 2025)
- **Purchase URL**: https://shop.transistorsoft.com/collections/frontpage

### What the License Covers
✅ Production iOS builds (App Store)  
✅ Unlimited apps for single organization  
✅ Perpetual license (no annual renewal)  
✅ All future minor/patch updates  
✅ Email support

### What's NOT Included
❌ Free trial license (no production builds)  
❌ Android license (separate purchase: $399)  
❌ Major version upgrades (e.g., v5.x → v6.x)  
❌ Priority support (requires separate support contract)

---

## Purchase Process

### Step 1: Pre-Purchase Verification
Before purchasing, verify the plugin version:

```bash
cd ~/workspace
grep "@transistorsoft/capacitor-background-geolocation" package.json
```

**Current Version**: Check package.json (likely v4.x or v5.x)

### Step 2: Purchase License
1. Visit: https://shop.transistorsoft.com/collections/frontpage
2. Select: **Capacitor Background Geolocation - iOS License**
3. Add to cart: $399 USD
4. Checkout with company email (recommended for invoicing)
5. Payment methods: Credit card, PayPal

**Important**: Use company email for license registration (not personal email)

### Step 3: Receive License Key
After purchase, you'll receive:
- **Order Confirmation Email** (immediate)
- **License Key Email** (within 24 hours)

Email contains:
```
License Owner: ABC Construction Inc.
License Key: ABC123-DEF456-GHI789-JKL012
Product: capacitor-background-geolocation (iOS)
Version: 5.x
Expires: Never (perpetual)
```

**Action**: Save this email! You'll need the license key for Xcode configuration.

---

## Xcode License Configuration

### Step 1: Open Xcode Workspace
```bash
cd ~/workspace/ios/App
open App.xcworkspace  # ⚠️ Always open .xcworkspace, NOT .xcodeproj
```

### Step 2: Add License Key to Info.plist
Navigate in Xcode:
```
App.xcworkspace → App → App → Info.plist
```

Add new key-value pair:
- **Key**: `TSLocationManager`
- **Type**: Dictionary
- **Child Key**: `license`
- **Child Type**: String
- **Child Value**: `ABC123-DEF456-GHI789-JKL012` (your actual license key)

**Info.plist XML**:
```xml
<key>TSLocationManager</key>
<dict>
    <key>license</key>
    <string>ABC123-DEF456-GHI789-JKL012</string>
</dict>
```

### Step 3: Verify Configuration
The plugin will auto-validate the license on first initialization. No additional code required.

**Expected Behavior**:
- ✅ Valid License: Plugin initializes silently
- ❌ Invalid License: Throws error on `BackgroundGeolocation.ready()`
- ⚠️ Missing License: Displays watermark alert (development only)

---

## Testing License Validity

### Development Environment (No License Required)
```typescript
// In development, the plugin works without a license
// but displays periodic watermark alerts

import BackgroundGeolocation from "@transistorsoft/capacitor-background-geolocation";

BackgroundGeolocation.ready({
  desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
  distanceFilter: 10,
}).then((state) => {
  console.log("BackgroundGeolocation is ready:", state);
  // No errors = license valid (or in dev mode)
}).catch((error) => {
  console.error("License validation failed:", error);
  // Error message will indicate if license is invalid
});
```

### Production Build (License Required)
1. Build for iOS device (not simulator):
   ```bash
   cd ~/workspace
   npx cap sync ios
   ```

2. Open in Xcode and select **Any iOS Device (arm64)**

3. Product → Archive

4. If license is invalid, build will succeed but runtime will fail:
   ```
   Error: [BackgroundGeolocation] Invalid or expired license key
   ```

5. If license is valid, no errors in console

---

## License Validation Error Handling

Add this to `client/src/lib/geofencing.ts`:

```typescript
export async function initializeGeofencing(userId: string) {
  try {
    const state = await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,
      stopTimeout: 5,
      debug: false, // Set true for development
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
    });

    console.log("[Geofencing] BackgroundGeolocation ready:", state);
    return state;

  } catch (error: any) {
    // Check for license-related errors
    if (error.message?.includes('license')) {
      console.error('[Geofencing] LICENSE ERROR:', error);
      
      // Show user-friendly error (admin only)
      if (isAdmin) {
        toast({
          title: 'Location Services Unavailable',
          description: 'Please contact support to activate location features.',
          variant: 'destructive',
        });
      }
      
      throw new Error('Background geolocation license invalid');
    }
    
    // Other initialization errors
    console.error('[Geofencing] Initialization error:', error);
    throw error;
  }
}
```

**User-Facing Error Messages**:
- ❌ Don't expose license details to regular users
- ✅ Show generic "Location services unavailable" message
- ✅ Log full error for admin debugging

---

## iOS Geofence Limits

### Apple's System Restrictions
iOS imposes a hard limit:
- **Maximum geofences per app**: 20 simultaneous geofences
- **Cannot be increased** (system limitation, not TransistorSoft)
- **Exceeding limit**: Oldest geofences are removed automatically

### FieldSnaps Strategy
With potentially 50+ construction projects, we need intelligent geofence management.

#### Option 1: Proximity-Based (Recommended)
Only monitor geofences near the user's current location:

```typescript
const MAX_GEOFENCES = 20;
const PROXIMITY_RADIUS_MILES = 25; // Only monitor sites within 25 miles

async function updateGeofences(userId: string, currentLocation: {lat: number, lng: number}) {
  // Get all projects for company
  const allProjects = await storage.getProjectsByCompany(companyId);
  
  // Filter to projects within proximity radius
  const nearbyProjects = allProjects
    .filter(project => {
      const distance = calculateDistance(
        currentLocation,
        { lat: project.latitude, lng: project.longitude }
      );
      return distance <= PROXIMITY_RADIUS_MILES;
    })
    .slice(0, MAX_GEOFENCES); // Hard limit to 20
  
  // Update geofences
  await BackgroundGeolocation.removeGeofences();
  
  for (const project of nearbyProjects) {
    await BackgroundGeolocation.addGeofence({
      identifier: project.id,
      radius: 500, // 500ft = ~152m
      latitude: project.latitude,
      longitude: project.longitude,
      notifyOnEntry: true,
      notifyOnExit: true,
    });
  }
  
  console.log(`[Geofencing] Monitoring ${nearbyProjects.length} nearby sites`);
}
```

#### Option 2: Priority-Based
Monitor most important sites based on activity:

```typescript
async function updateGeofencesPriority(userId: string) {
  const projects = await storage.getProjectsByCompany(companyId);
  
  // Sort by last activity (most recent first)
  const prioritizedProjects = projects
    .sort((a, b) => {
      const aLastActivity = a.lastPhotoTimestamp || a.createdAt;
      const bLastActivity = b.lastPhotoTimestamp || b.createdAt;
      return bLastActivity.getTime() - aLastActivity.getTime();
    })
    .slice(0, MAX_GEOFENCES);
  
  // Add geofences
  await BackgroundGeolocation.removeGeofences();
  for (const project of prioritizedProjects) {
    await BackgroundGeolocation.addGeofence({
      identifier: project.id,
      radius: 500,
      latitude: project.latitude,
      longitude: project.longitude,
      notifyOnEntry: true,
      notifyOnExit: true,
    });
  }
}
```

#### Option 3: Manual Selection (Admin Control)
Allow admins to select which 20 sites to monitor:

```typescript
// Add to projects table
export const projects = pgTable("projects", {
  // ... existing fields
  geofenceEnabled: boolean("geofence_enabled").default(false),
  geofencePriority: integer("geofence_priority").default(0),
});

async function updateGeofencesManual(companyId: string) {
  const enabledProjects = await db
    .select()
    .from(projects)
    .where(and(
      eq(projects.companyId, companyId),
      eq(projects.geofenceEnabled, true)
    ))
    .orderBy(desc(projects.geofencePriority))
    .limit(MAX_GEOFENCES);
  
  // Add geofences
  await BackgroundGeolocation.removeGeofences();
  for (const project of enabledProjects) {
    await BackgroundGeolocation.addGeofence({
      identifier: project.id,
      radius: 500,
      latitude: project.latitude,
      longitude: project.longitude,
      notifyOnEntry: true,
      notifyOnExit: true,
    });
  }
}
```

**Recommendation**: Use **Option 1 (Proximity-Based)** for MVP. It requires no admin configuration and works automatically.

---

## Implementation Checklist

### Pre-Purchase (Complete First)
- [x] Verify plugin is installed in package.json
- [x] Confirm iOS deployment is required
- [x] Get company payment approval ($399)

### Purchase & Configuration
- [ ] Purchase iOS license from TransistorSoft shop
- [ ] Receive license key via email (save securely)
- [ ] Add license key to Xcode Info.plist under `TSLocationManager`
- [ ] Build archive and test on physical device
- [ ] Verify no license errors in console logs

### Geofence Limit Implementation
- [ ] Implement proximity-based geofence management
- [ ] Add `MAX_GEOFENCES = 20` constant to geofencing.ts
- [ ] Test geofence rotation with 25+ projects
- [ ] Document behavior in replit.md
- [ ] Add admin warning if company has >20 active projects

### Production Validation
- [ ] Build production archive (Product → Archive in Xcode)
- [ ] Deploy to TestFlight
- [ ] Test on physical iPhone (not simulator)
- [ ] Verify automatic clock-in/out works
- [ ] Verify no license watermarks appear
- [ ] Test with 3+ projects to ensure geofences work

---

## Troubleshooting

### Error: "Invalid license key"
**Cause**: License key not added to Info.plist or incorrect format  
**Solution**: 
1. Verify `TSLocationManager` → `license` exists in Info.plist
2. Check for typos in license key (copy-paste from email)
3. Ensure key is String type, not Number

### Error: "License expired"
**Cause**: License is time-limited (wrong license type)  
**Solution**: Contact TransistorSoft support - iOS licenses should be perpetual

### Watermark Alert: "This app is using an unlicensed version..."
**Cause**: No license configured (development mode)  
**Solution**: 
- In development: Ignore (expected behavior)
- In production: Add license key to Info.plist

### Error: "Cannot add more than 20 geofences"
**Cause**: iOS system limit exceeded  
**Solution**: Implement proximity-based or priority-based geofence management

### Geofences not triggering
**Possible Causes**:
1. **Location Permission**: Verify "Always Allow" is granted
2. **Radius Too Small**: 500ft minimum recommended
3. **Battery Optimization**: Significant location change mode active
4. **Testing on Simulator**: Geofences don't work on simulator, use physical device

**Debug**:
```typescript
BackgroundGeolocation.ready({
  debug: true, // Enable debug mode
  logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
});

// Check current geofences
BackgroundGeolocation.getGeofences().then(geofences => {
  console.log('[Geofencing] Current geofences:', geofences);
});
```

---

## Support & Resources

### TransistorSoft Documentation
- Plugin Docs: https://transistorsoft.github.io/capacitor-background-geolocation/
- iOS Setup: https://transistorsoft.github.io/capacitor-background-geolocation/classes/backgroundgeolocation.html
- Geofencing Guide: https://transistorsoft.github.io/capacitor-background-geolocation/#geofencing

### Contact Support
- Email: info@transistorsoft.com
- Forum: https://github.com/transistorsoft/capacitor-background-geolocation/issues
- Response Time: 24-48 hours (email), 1-7 days (forum)

### License Questions
- Email: sales@transistorsoft.com
- Include: Order number, license key, company name

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| iOS License | $399 | One-time |
| Android License | $399 | One-time (future) |
| Annual Support | $0 | Included |
| Major Upgrades | Variable | Optional |

**Total for iOS MVP**: **$399 USD**

---

## Next Steps

1. **Immediate**: Document license requirement in budget/planning
2. **Before iOS Submission**: Purchase license and configure Xcode
3. **After Purchase**: Implement 20-geofence limit logic (Phase 3, Task 9)
4. **Testing**: Validate on physical device before App Store submission

---

**Document Version**: 1.0  
**Last Updated**: November 19, 2025  
**Status**: Ready for purchase and configuration
