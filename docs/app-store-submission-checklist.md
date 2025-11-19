# App Store Submission Checklist
## Final Pre-Submission Validation for FieldSnaps

**Document Purpose**: Comprehensive checklist covering all requirements before submitting FieldSnaps to Apple App Store.

**Completion Criteria**: All items marked ✅ before initiating App Store submission.

---

## 1. Code Quality & Security

### Production Code
- [ ] Remove all `console.log()` statements from production code
- [ ] Remove all `TODO` comments from code
- [ ] Remove all placeholder text ("Lorem ipsum", "Test data", etc.)
- [ ] Verify no hardcoded API keys or secrets in code
- [ ] All sensitive data in environment variables
- [ ] Error boundaries implemented on all pages
- [ ] No unhandled promise rejections
- [ ] No memory leaks in long-running processes

### Security Headers & Configuration
- [ ] Content Security Policy (CSP) configured
- [ ] HTTPS enforced for all API requests
- [ ] Session cookies marked `httpOnly` and `secure`
- [ ] Rate limiting enabled on all API endpoints
- [ ] Input validation on all form submissions
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized user inputs)

### Performance Optimization
- [ ] Images optimized and compressed
- [ ] Lazy loading implemented for photos
- [ ] Code splitting for route-based chunks
- [ ] Service Worker caching configured
- [ ] IndexedDB storage limits respected
- [ ] Memory usage <150MB on iOS
- [ ] App launch time <2 seconds

---

## 2. iOS Native Integration

### Capacitor Configuration
- [ ] `capacitor.config.ts` configured correctly
- [ ] App ID matches App Store Connect
- [ ] App name matches marketing name
- [ ] Version number follows semver (e.g., 1.0.0)
- [ ] Build number increments for each TestFlight build

### Info.plist Privacy Descriptions
- [ ] `NSCameraUsageDescription` - Clear explanation
- [ ] `NSPhotoLibraryUsageDescription` - Clear explanation
- [ ] `NSPhotoLibraryAddUsageDescription` - Clear explanation
- [ ] `NSLocationWhenInUseUsageDescription` - Worker-benefit framing
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription` - Worker-benefit framing
- [ ] `NSLocationAlwaysUsageDescription` - Worker-benefit framing
- [ ] `NSMicrophoneUsageDescription` - If using voice features
- [ ] All descriptions emphasize worker benefits (not employer monitoring)

### TransistorSoft Background Geolocation
- [ ] License key added to `Info.plist`
- [ ] License purchased from TransistorSoft
- [ ] License validated in production build
- [ ] Error handling for license validation
- [ ] Graceful degradation if license invalid

### Native Permissions
- [ ] Camera permission requested on first use
- [ ] Location permission requested on first use
- [ ] Notification permission requested appropriately
- [ ] Permission denial handled gracefully (no crash)
- [ ] Users can change permissions in Settings

---

## 3. App Store Assets

### App Icons
- [ ] 1024x1024 App Store icon (PNG, no transparency)
- [ ] 180x180 iPhone App icon
- [ ] 167x167 iPad App icon (if supporting iPad)
- [ ] 120x120 iPhone App icon (@2x)
- [ ] 87x87 iPhone App icon (@3x)
- [ ] All icons have rounded corners removed (iOS adds automatically)
- [ ] Icons match brand guidelines
- [ ] No text in icons (violates Apple guidelines)

### Screenshots (Required for App Store)
See `docs/ios-app-store-review-strategy.md` for detailed screenshot requirements:

**iPhone 6.7" (iPhone 15 Pro Max, 14 Pro Max):**
- [ ] Screenshot 1: Camera interface with timestamp and location
- [ ] Screenshot 2: Photo gallery with projects organized
- [ ] Screenshot 3: To-Do list with photo attachments
- [ ] Screenshot 4: Timesheet with clock-in/out entries
- [ ] Screenshot 5: Location Privacy screen (worker benefit messaging)

**iPhone 6.5" (iPhone 11 Pro Max, XS Max):**
- [ ] Same 5 screenshots as 6.7" (required by Apple)

**Optional (Recommended):**
- [ ] iPad Pro 12.9" screenshots (if supporting iPad)

### Demo Video
- [ ] Create demo video following `docs/demo-video-script.md`
- [ ] Duration: 15-30 seconds
- [ ] Highlights: Photo capture, To-Do, Time tracking
- [ ] Emphasizes worker benefits
- [ ] No music with copyright issues
- [ ] Video uploaded to App Store Connect

---

## 4. App Store Connect Configuration

### App Information
- [ ] App Name: "FieldSnaps - Construction Photos"
- [ ] Subtitle: "Photo Documentation & Time Tracking"
- [ ] Category: Productivity
- [ ] Keywords: construction, photos, time tracking, fieldwork, documentation
- [ ] Privacy Policy URL: Active and accessible
- [ ] Terms of Service URL: Active and accessible
- [ ] Support URL: Active with contact information

### App Description
- [ ] Highlights worker benefits (not employer monitoring)
- [ ] Emphasizes ease of use and time savings
- [ ] Mentions key features: photos, to-do, time tracking
- [ ] Includes call-to-action: "Download now"
- [ ] No excessive capitalization or emojis

**Example Description:**
```
FieldSnaps helps construction workers document their work and track time effortlessly.

✓ Instant Photo Capture - Take timestamped photos with location
✓ Smart Organization - Organize by project with automatic folders
✓ To-Do Lists - Never miss a task with photo attachments
✓ Automatic Time Tracking - Clock in/out automatically at job sites
✓ Offline Mode - Works without WiFi, syncs when connected

Your work, your records, your time - all in one simple app.

Pricing: $19.99/user/month after 14-day free trial.
```

### App Review Information
- [ ] Contact information for App Review team
- [ ] Test account credentials (username/password)
- [ ] Demo instructions for reviewers
- [ ] Notes about geofencing (requires real-world location)
- [ ] Notes about TransistorSoft license key

**Example App Review Notes:**
```
Test Account:
Username: reviewer@fieldsnaps.com
Password: TestPass2025!

Demo Instructions:
1. Login with test account
2. Create a test project (any address)
3. Take a photo using camera
4. Add a to-do item with photo attachment
5. Clock in/out manually (geofencing requires real-world testing)

Location Tracking:
This app uses background location for automatic time tracking. Workers benefit from accurate time records and reduced manual effort. See "Location Privacy" screen in Settings for full transparency.

TransistorSoft License:
Production license key is configured in Info.plist. License is valid through 2026.
```

---

## 5. Compliance & Legal

### Privacy Policy
- [ ] Privacy Policy URL is active
- [ ] Policy explains data collection (photos, location, time)
- [ ] Policy explains data usage (time tracking, project organization)
- [ ] Policy explains data retention (30-day trash bin, then deleted)
- [ ] Policy explains third-party services (Replit Object Storage, Stripe)
- [ ] Policy includes contact information
- [ ] Policy includes "Do Not Sell My Info" for California users

### Terms of Service
- [ ] Terms of Service URL is active
- [ ] Terms include subscription pricing ($19.99/user/month)
- [ ] Terms include refund policy
- [ ] Terms include acceptable use policy
- [ ] Terms include liability limitations

### GDPR Compliance (if serving EU users)
- [ ] Data export feature implemented
- [ ] Data deletion feature implemented
- [ ] Cookie consent banner (if applicable)
- [ ] Privacy policy includes GDPR rights

---

## 6. Testing & Quality Assurance

### Phase 4: Touch Gestures & Haptics
- [ ] Tap gestures feel instant (<100ms delay)
- [ ] Swipe gestures run at 60fps (no jank)
- [ ] Haptic feedback triggers correctly on all interactions
- [ ] Long-press gestures work as expected
- [ ] Tested on iPhone 15 Pro, 14 Pro, SE (3rd gen)

### Phase 5: Safe Areas & Native Features
- [ ] Content respects Dynamic Island (iPhone 14/15 Pro)
- [ ] Content respects home indicator (all notch iPhones)
- [ ] Keyboard never hides inputs
- [ ] Camera works in portrait and landscape
- [ ] Geofencing triggers correctly in background
- [ ] Offline mode saves data and syncs when online
- [ ] Tested on 3+ physical devices

### Phase 6: Performance Benchmarks
- [ ] App launch time <2 seconds
- [ ] Camera open time <500ms
- [ ] Photo capture time <200ms
- [ ] List scroll at 60fps
- [ ] Memory usage <150MB
- [ ] Battery drain <10% over 8-hour shift

### TestFlight Beta Testing
- [ ] Deployed to TestFlight
- [ ] Tested by 3+ field workers
- [ ] Beta testing duration: 1+ week
- [ ] Crash reports reviewed and fixed
- [ ] User feedback incorporated

---

## 7. Subscription & Payments

### Stripe Integration
- [ ] Stripe account configured for production
- [ ] Subscription plan created ($19.99/month)
- [ ] Webhook endpoints configured
- [ ] Payment flow tested end-to-end
- [ ] Failed payment handling implemented
- [ ] Subscription cancellation flow works

### Apple In-App Purchase (Optional)
- [ ] If offering IAP, configured in App Store Connect
- [ ] IAP products match Stripe pricing
- [ ] IAP receipt validation implemented
- [ ] Restore purchases functionality works

### Free Trial
- [ ] 14-day free trial configured
- [ ] Trial expiration handled gracefully
- [ ] User notified before trial ends
- [ ] Subscription prompt appears at trial end

---

## 8. Deployment & Build

### Xcode Configuration
- [ ] Xcode project opens without errors
- [ ] Signing & Capabilities configured
- [ ] Push Notifications capability enabled (if using)
- [ ] Background Modes enabled: Location updates, Background fetch
- [ ] Team and provisioning profile selected

### Build & Archive
- [ ] Archive builds successfully
- [ ] No compiler warnings
- [ ] No missing assets or resources
- [ ] Build size <100MB (ideally <50MB)
- [ ] Bitcode included (optional but recommended)

### TestFlight Upload
- [ ] Build uploaded to App Store Connect
- [ ] Build processing completed (no errors)
- [ ] TestFlight invite sent to internal testers
- [ ] TestFlight beta tested for 1+ week

---

## 9. App Store Submission

### Pre-Submission Validation
- [ ] All items in this checklist marked ✅
- [ ] No crashes in production build
- [ ] All features working as expected
- [ ] User feedback from TestFlight incorporated
- [ ] Marketing materials finalized

### Submit for Review
1. [ ] Log into App Store Connect
2. [ ] Select "FieldSnaps" app
3. [ ] Click "Prepare for Submission"
4. [ ] Upload all screenshots
5. [ ] Upload demo video (optional but recommended)
6. [ ] Fill out app description
7. [ ] Fill out keywords
8. [ ] Fill out privacy policy URL
9. [ ] Fill out support URL
10. [ ] Fill out app review notes
11. [ ] Click "Submit for Review"

### Review Timeline
- **Typical**: 24-48 hours
- **First submission**: 3-7 days
- **If rejected**: Address issues and resubmit within 2 weeks

---

## 10. Post-Submission Monitoring

### After Submission
- [ ] Monitor App Store Connect for status updates
- [ ] Check email for App Review team messages
- [ ] Respond to reviewer questions within 24 hours
- [ ] Monitor crash reports in App Store Connect

### If Approved
- [ ] Celebrate! 🎉
- [ ] Update marketing materials with App Store link
- [ ] Notify beta testers of public release
- [ ] Monitor user reviews and ratings
- [ ] Plan for future updates

### If Rejected
- [ ] Read rejection reason carefully
- [ ] Address specific issues mentioned
- [ ] Update code/assets as needed
- [ ] Resubmit with detailed resolution notes
- [ ] Common rejection reasons:
  - Location tracking not framed as user benefit
  - Privacy descriptions too vague
  - App crashes during review
  - Missing test account credentials

---

## Quick Reference: Common Rejection Reasons

### Location Tracking
**Rejection**: "Your app uses background location but doesn't clearly explain how this benefits the user."

**Fix**: Ensure Location Privacy screen is accessible from Settings and emphasizes worker benefits (accurate pay, mileage tracking, personal time records). See `docs/ios-app-store-review-strategy.md`.

### Privacy Descriptions
**Rejection**: "NSLocationAlwaysUsageDescription is too generic."

**Fix**: Update Info.plist to explain how location tracking helps workers (not just employers). Example:

```xml
<key>NSLocationAlwaysUsageDescription</key>
<string>FieldSnaps tracks your location to automatically clock you in and out at job sites, ensuring accurate pay and personal time records. You stay in control with our Location Privacy settings.</string>
```

### Test Account Issues
**Rejection**: "We were unable to sign in with the provided test account."

**Fix**: Verify test account credentials are correct and active. Include step-by-step login instructions in App Review Notes.

### App Crashes
**Rejection**: "Your app crashed when we attempted to [action]."

**Fix**: Reproduce the crash, fix the bug, and add error handling. Test thoroughly on physical devices before resubmitting.

---

## Final Sign-Off

**Deployment Lead**: _____________________ Date: _______

**QA Lead**: _____________________ Date: _______

**Product Owner**: _____________________ Date: _______

**Checklist Complete**: Once all items are ✅, FieldSnaps is ready for App Store submission.

---

**Document Version**: 1.0  
**Last Updated**: November 19, 2025  
**Status**: Ready for final pre-submission validation
