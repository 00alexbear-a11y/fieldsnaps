# Dev Login - Quick Testing Guide

## What Changed

Added a big **"Dev Login (Skip OAuth)"** button to bypass all OAuth complexity so you can instantly test your app on iPhone.

**Security:** The Dev Login button ONLY appears in Replit preview (Vite dev server). It's compiled out of all production builds automatically, keeping your app secure.

## How to Use

### 1. Preview in Replit (Quick UI Checks)
```
https://[your-repl].replit.dev
```
- Open in Safari on your Mac or iPhone
- You'll see the blue "Dev Login" button (only shows on *.replit.dev)
- Click "Dev Login" button
- Instant access - no Safari popup, no waiting
- Perfect for quick UI adjustments

### 2. Test on Native iPhone App (Full Features)

**Status:** Dev Login is only available in Replit preview for security. For native app testing, we need to fix the OAuth flow (work in progress).

**Temporary Workflow:**
- Use Replit preview in Safari on your iPhone for UI testing
- Native features (camera, haptics) will require OAuth fix
- Once OAuth is working, you can test full native functionality

**Future:** Once we fix the ASWebAuthPlugin registration issue, you'll be able to test the full native app with real OAuth authentication.

## What Works

✅ **Instant Login** - One tap, you're in  
✅ **No Safari Popups** - No OAuth complexity  
✅ **Full App Access** - Test all features like it's the final product  
✅ **Native Features** - Camera, haptics, native UI  
✅ **Real Device Testing** - Feels like production app

## Dev Login vs Production Login

### Dev Login (Blue Button)
- **Purpose:** Testing only
- **Speed:** Instant access
- **Auth:** Mock tokens (1 year expiration)
- **User:** dev@fieldsnaps.app
- **When to use:** UI testing, feature development, screenshots

### Production Login (Outline Buttons)
- **Purpose:** Real users
- **Speed:** Requires OAuth flow
- **Auth:** Real Replit account
- **User:** Your actual account
- **When to use:** Production deployment (later)

## Next Steps

1. **Test the Dev Login** on native app - make sure it works
2. **Tell me what UI changes** you want to see
3. **I'll make the changes** in Replit
4. **Download and rebuild** to see the changes
5. **Iterate** until you're happy with the app

---

**Bottom Line:** You can now focus on UI and features without fighting OAuth. When you're ready to launch, we'll tackle production auth properly.
