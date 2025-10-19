# Apple App Store Compliance Report - FieldSnaps

**Generated:** October 19, 2025  
**App Version:** 1.0 (Pre-submission)  
**Target Platform:** iOS

---

## 🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ACTION

### 1. **PAYMENT COMPLIANCE VIOLATION** - Must Fix Before Submission

**Status:** ❌ **NON-COMPLIANT**

**Issue:**  
FieldSnaps currently uses **external Stripe checkout** for all subscription payments ($19.99/user). This violates Apple's App Store guidelines for digital goods and services.

**Apple Requirement:**  
- **Digital subscriptions MUST use Apple In-App Purchase (IAP)** globally
- External payment systems (Stripe) are ONLY allowed for:
  - Physical goods (e.g., clothing, electronics)
  - Real-world services (e.g., food delivery, ride-sharing)
  - U.S. apps only (as of April 2025 ruling) can add external payment links

**FieldSnaps Classification:**  
- ✅ Digital service (construction photo management SaaS)
- ❌ NOT a physical good
- ❌ NOT a real-world service
- **Conclusion:** Must use Apple IAP

**Required Actions:**

1. **Implement Apple In-App Purchase (IAP)**
   - Set up auto-renewable subscriptions in App Store Connect
   - Integrate StoreKit 2 SDK for iOS
   - Configure subscription product: $19.99/month per user
   - Implement 7-day free trial via IAP

2. **Revenue Share Impact**
   - Year 1: Apple takes 30% ($6.00) → You receive $13.99
   - Year 2+: Apple takes 15% ($3.00) → You receive $16.99
   - Current Stripe fee: 2.9% + $0.30 = $0.88 → You receive $19.11

3. **Migration Strategy Options**

   **Option A: IAP Only (Global Compliance)**
   - Remove Stripe completely
   - Use Apple IAP for all markets
   - ✅ Simple, compliant everywhere
   - ❌ Higher fees (15-30% vs 2.9%)

   **Option B: Hybrid (U.S. + Global)**
   - Implement Apple IAP (required for all markets)
   - Add external Stripe link for U.S. users only
   - ✅ Lower fees for U.S. market
   - ❌ Complex implementation
   - ⚠️ Must still offer IAP as primary option

   **Option C: Reader App Exception (Not Applicable)**
   - Only for apps giving access to previously purchased content
   - Examples: Spotify, Netflix, Kindle
   - ❌ FieldSnaps doesn't qualify (users create content in-app)

**Recommendation:** Start with **Option A** (IAP only) for initial App Store approval. Add Option B (hybrid) in future update after establishing presence.

---

## ✅ COMPLIANT AREAS

### 2. **Privacy Manifest** ✅ 

**Status:** ✅ **COMPLIANT**

**Current Implementation:**
- Privacy manifest file created: `PrivacyInfo.xcprivacy`
- All required reason APIs declared:
  - ✅ UserDefaults (CA92.1 - app settings)
  - ✅ File Timestamp (C617.1, 3B52.1 - photo metadata)
  - ✅ Disk Space (E174.1, 85F4.1 - storage management)
  - ✅ System Boot Time (35F9.1 - sync timing)
- Data collection types properly declared:
  - ✅ Photos/Videos (app functionality)
  - ✅ User ID (authentication)
  - ✅ Email Address (account management)
  - ✅ Device ID (subscription management)
  - ✅ Precise Location (project geolocation)

**Action Required:**
- ✅ Ensure file is added to Xcode project (already documented in build guide)
- ✅ Verify file appears in "Copy Bundle Resources" build phase

---

### 3. **Privacy Permissions** ✅

**Status:** ✅ **COMPLIANT (Documented)**

**Required Info.plist Descriptions:**
- ✅ `NSCameraUsageDescription` - Camera access for photo/video capture
- ✅ `NSPhotoLibraryUsageDescription` - Photo library access for uploads
- ✅ `NSLocationWhenInUseUsageDescription` - Location for project geotagging
- ✅ `NSFaceIDUsageDescription` - Biometric authentication

**Action Required:**
- ⚠️ Verify these are added to actual `ios/App/App/Info.plist` file during iOS build
- Documented in `IOS_BUILD_GUIDE.md` Step 5

---

### 4. **Privacy Policy** ✅

**Status:** ✅ **COMPLIANT**

**Current Implementation:**
- Comprehensive privacy policy: `PRIVACY_POLICY.md`
- Covers all data collection types
- Explains third-party services (Stripe, Google Maps, Replit)
- Clear data retention and deletion policies
- Security measures documented

**Action Required:**
- ✅ Host on public URL (required for App Store Connect)
- ✅ Link from app settings page
- ⚠️ Update Stripe section if switching to IAP

---

## ⚠️ AREAS REQUIRING VERIFICATION

### 5. **SDK Requirements** ⚠️

**Status:** ⚠️ **REQUIRES UPDATE (April 2025)**

**Current Status:**
- Capacitor 6 installed ✅
- Xcode 15+ recommended ✅

**Apple Requirement (Starting April 2025):**
- Must be built with **iOS 18 SDK**
- Must use **Xcode 15 or later**
- Applies to all new submissions and updates after April 2025

**Action Required:**
- ⏰ Before April 2025: Update Xcode to 15+
- ⏰ Before April 2025: Set iOS deployment target to iOS 18
- Update `IOS_BUILD_GUIDE.md` with specific version requirements

---

### 6. **App Completeness** ⚠️

**Status:** ⚠️ **NEEDS PRE-SUBMISSION TESTING**

**Apple Rejection Triggers:**
- ❌ Crashes on launch
- ❌ Placeholder content or "lorem ipsum" text
- ❌ Broken links (support, privacy policy)
- ❌ Missing demo account credentials
- ❌ Incomplete features

**Current Status:**
- App appears feature-complete ✅
- No obvious placeholders ✅
- Need to verify:
  - ⚠️ Support email/link functional
  - ⚠️ Privacy policy hosted and accessible
  - ⚠️ Demo account created for App Review
  - ⚠️ All navigation flows work
  - ⚠️ Offline mode functions properly

**Action Required:**
1. Create demo account with sample projects/photos
2. Document demo credentials in App Store Connect review notes
3. Host privacy policy on public URL
4. Test all features on physical iOS device
5. Ensure app doesn't crash on iPhone 15, 14, 13 (various iOS versions)

---

### 7. **Third-Party SDKs** ⚠️

**Status:** ⚠️ **NEEDS VERIFICATION**

**Current SDKs:**
- Capacitor 6 plugins (Camera, Device, Filesystem, Preferences)
- Capgo OTA updater
- Stripe SDK (needs review/removal if switching to IAP)
- Google Cloud Storage
- Various npm packages

**Apple Requirement:**
- All third-party SDKs must include privacy manifests
- As of May 2024, apps without SDK privacy manifests are rejected

**Action Required:**
1. Verify all Capacitor plugins have privacy manifests
2. Check Capgo SDK includes privacy manifest
3. Review Stripe SDK (may remove if switching to IAP)
4. Scan for SDKs on Apple's [required list](https://developer.apple.com/support/third-party-SDK-requirements/)

---

## 📋 PRE-SUBMISSION CHECKLIST

### Must Complete Before First Submission

- [ ] **CRITICAL:** Implement Apple In-App Purchase (IAP)
- [ ] Remove or supplement Stripe external checkout
- [ ] Add `PrivacyInfo.xcprivacy` to Xcode project
- [ ] Verify Info.plist permission descriptions
- [ ] Host privacy policy on public URL
- [ ] Create demo account with sample data
- [ ] Test on physical iPhone (latest iOS)
- [ ] Test on older iPhone (iOS 15-16)
- [ ] Verify all links work (support, privacy policy)
- [ ] Generate screenshots (6.7", 6.5", 5.5" displays)
- [ ] Prepare app description and keywords
- [ ] Set age rating (likely 4+)
- [ ] Configure App Store Connect listing

### Recommended Before Submission

- [ ] Test offline mode thoroughly
- [ ] Test camera on all iPhone models available
- [ ] Verify photo compression quality
- [ ] Test 7-day free trial flow
- [ ] Verify subscription management flow
- [ ] Test biometric login (Face ID/Touch ID)
- [ ] Run performance testing (no lag)
- [ ] Check memory usage (no leaks)
- [ ] Verify dark mode appearance
- [ ] Test accessibility features

---

## 🎯 RECOMMENDED TIMELINE

### Immediate (This Week)
1. Research and plan Apple IAP implementation
2. Create demo account with sample projects
3. Host privacy policy on public URL

### Short-term (1-2 Weeks)
4. Implement Apple In-App Purchase SDK
5. Test IAP subscription flow end-to-end
6. Update app UI to use IAP checkout
7. Add Info.plist permissions to iOS project
8. Verify all third-party SDK privacy manifests

### Pre-Submission (Week Before)
9. Complete thorough device testing
10. Generate App Store screenshots
11. Write app description and metadata
12. Final crash testing and performance review
13. Submit to App Store Connect

### Post-Submission
14. Monitor App Review feedback
15. Respond quickly to any rejection reasons
16. Keep demo account credentials accessible

---

## 📚 REFERENCE LINKS

### Official Apple Documentation
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [In-App Purchase Documentation](https://developer.apple.com/in-app-purchase/)
- [Privacy Manifest Files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Required Reason API](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api)
- [App Store Connect](https://appstoreconnect.apple.com)

### Helpful Guides
- [StoreKit 2 Tutorial](https://developer.apple.com/documentation/storekit)
- [Auto-Renewable Subscriptions](https://developer.apple.com/app-store/subscriptions/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## 💰 FINANCIAL COMPARISON

### Current Setup (Stripe - Non-Compliant)
- Monthly subscription: $19.99/user
- Stripe fee: 2.9% + $0.30 = **$0.88**
- **You receive: $19.11 (95.6%)**

### Required Setup (Apple IAP)
- Monthly subscription: $19.99/user
- Year 1: Apple fee 30% = **$6.00**
- **You receive: $13.99 (70.0%)**

- Year 2+: Apple fee 15% = **$3.00**
- **You receive: $16.99 (85.0%)**

### Impact Per 100 Users/Month
- Current (Stripe): $1,911/month
- Year 1 (IAP): $1,399/month → **-$512 loss**
- Year 2+ (IAP): $1,699/month → **-$212 loss**

### Mitigation Strategies
1. **Increase price to $24.99** to offset Apple's 30% cut
   - Year 1: You receive $17.49 (vs $19.11 with Stripe)
   - Impact reduced to -$162 per 100 users
2. **Promote web signup** (where allowed) for direct Stripe billing
3. **Implement hybrid model** (U.S. only with external link)

---

## 🎓 MISSIONARY MISSION IMPACT

Given your 20% donation commitment to missionaries:

### Current Model (Stripe)
- Revenue per user: $19.11
- Donation per user: $3.82 (20%)

### Apple IAP Model
- Year 1: $13.99 → **$2.80 donation** (-$1.02/user)
- Year 2+: $16.99 → **$3.40 donation** (-$0.42/user)

**Recommendation:** Consider increasing subscription price to $24.99 to maintain donation levels while covering Apple's fees.

---

## ✅ CONCLUSION

**Overall Compliance Status: ⚠️ REQUIRES CRITICAL FIXES**

**Must Fix:**
1. 🚨 Implement Apple In-App Purchase (IAP) - CRITICAL
2. ⚠️ Verify iOS project configuration (Info.plist, privacy manifest)
3. ⚠️ Create demo account and host privacy policy

**Ready for Submission:**
- ✅ Privacy manifest complete and comprehensive
- ✅ Privacy policy written and detailed
- ✅ App architecture well-documented
- ✅ Feature set appears complete

**Estimated Time to Compliance:**
- 2-3 weeks for IAP implementation and testing
- Additional 1 week for final pre-submission checklist

---

**Next Steps:** Review this report and prioritize implementing Apple In-App Purchase as the first critical task before App Store submission.
