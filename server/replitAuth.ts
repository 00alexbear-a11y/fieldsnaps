import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { emailService } from "./email";
import { generateTokenPair, verifyAccessToken, refreshAccessToken as refreshJwtAccessToken, revokeRefreshToken } from "./jwtService";
import { verifySupabaseToken, getOrCreateUserFromSupabase, extractTokenFromHeader } from "./supabaseAuth";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";
import { randomBytes } from "crypto";

// REPLIT_DOMAINS may not be set in local development
const isProduction = process.env.NODE_ENV === 'production';
const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];
const allDomains = isProduction ? replitDomains : [...replitDomains, 'localhost', '127.0.0.1', '0.0.0.0'];

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Always use secure cookies (required for sameSite: 'none')
      secure: true,
      // Use 'none' to allow cookies in Capacitor WebView loading from external domain
      // This is safe because we validate origins and use secure cookies
      sameSite: 'none',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Check if this is a new user (for welcome email)
  const existingUser = await storage.getUser(claims["sub"]);
  const isNewUser = !existingUser;

  // Create or update user
  const user = await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });

  // Send welcome email to new users
  if (isNewUser && user.email) {
    const userName = user.firstName || user.email.split('@')[0];
    try {
      await emailService.sendWelcomeEmail(user.email, userName);
      console.log(`[Auth] Welcome email sent to ${user.email}`);
    } catch (error) {
      // Don't fail auth if email fails - just log it
      console.error('[Auth] Failed to send welcome email:', error);
    }
  }
}

/**
 * Validate redirect URI to prevent open redirect attacks.
 * Only allows the native app scheme or same-origin URLs.
 * 
 * @param redirectUri - The redirect URI to validate
 * @param requestOrigin - The origin of the incoming request
 * @returns true if valid, false otherwise
 */
function isValidRedirectUri(redirectUri: string, requestOrigin: string): boolean {
  // Allow the native app custom URL scheme
  const NATIVE_APP_SCHEME = 'com.fieldsnaps.app://callback';
  if (redirectUri === NATIVE_APP_SCHEME) {
    return true;
  }

  // For web URLs, only allow same-origin redirects
  try {
    const redirectUrl = new URL(redirectUri);
    const requestUrl = new URL(requestOrigin);
    
    // Must be same protocol, host, and port
    return (
      redirectUrl.protocol === requestUrl.protocol &&
      redirectUrl.hostname === requestUrl.hostname &&
      redirectUrl.port === requestUrl.port
    );
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

export async function setupAuth(app: Express, authRateLimiter?: any) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of allDomains) {
    const protocol = isProduction || domain.startsWith('http') ? 'https' : 'http';
    const cleanDomain = domain.replace(/^https?:\/\//, '');
    
    // Include port for local development
    let callbackURL = `${protocol}://${cleanDomain}/api/callback`;
    if (!isProduction && !cleanDomain.includes(':')) {
      callbackURL = `${protocol}://${cleanDomain}:5000/api/callback`;
    }
    
    const strategy = new Strategy(
      {
        name: `replitauth:${cleanDomain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Check for invite token in query params
    const inviteToken = req.query.invite as string;
    if (inviteToken) {
      // Store invite token in session for use after auth
      (req.session as any).inviteToken = inviteToken;
    }
    
    // Check for custom redirect_uri (for native apps using deep linking)
    const redirectUri = req.query.redirect_uri as string;
    let stateData: any = {};
    
    console.log('[Auth Login] 🔐 OAuth flow initiated');
    console.log('[Auth Login] redirect_uri from query:', redirectUri || 'NOT PROVIDED');
    
    if (redirectUri) {
      // Validate redirect URI to prevent open redirect attacks
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      if (!isValidRedirectUri(redirectUri, requestOrigin)) {
        console.error('[Auth Login] ❌ Invalid redirect_uri rejected:', redirectUri);
        return res.status(400).json({ error: 'Invalid redirect_uri parameter' });
      }
      
      // Encode redirect_uri into OAuth state parameter instead of session
      // This works across Safari View Controller boundary
      stateData.redirect_uri = redirectUri;
      console.log('[Auth Login] ✅ redirect_uri validated:', redirectUri);
    }
    
    // Strip port from hostname for strategy lookup
    const strategyHost = req.hostname.split(':')[0];
    
    // Build authentication options with custom state if needed
    const authOptions: any = {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    };
    
    // If we have state data, encode it as JSON in the state parameter
    if (Object.keys(stateData).length > 0) {
      authOptions.state = Buffer.from(JSON.stringify(stateData)).toString('base64');
      console.log('[Auth Login] 📦 Encoded state parameter:', authOptions.state);
      console.log('[Auth Login] 📦 State data:', JSON.stringify(stateData));
    } else {
      console.log('[Auth Login] ⚠️ No state data to encode (no redirect_uri)');
    }
    
    console.log('[Auth Login] 🚀 Redirecting to OAuth provider...');
    passport.authenticate(`replitauth:${strategyHost}`, authOptions)(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log('[Auth Callback] 🔄 OAuth callback received');
    
    // Decode state parameter to extract redirect_uri (for native apps)
    let customRedirectUri: string | undefined;
    const stateParam = req.query.state as string;
    
    console.log('[Auth Callback] 📦 Raw state parameter:', stateParam || 'NOT PROVIDED');
    
    if (stateParam) {
      try {
        const decodedState = Buffer.from(stateParam, 'base64').toString('utf-8');
        console.log('[Auth Callback] 🔓 Decoded state string:', decodedState);
        
        const stateData = JSON.parse(decodedState);
        console.log('[Auth Callback] 📋 Parsed state data:', JSON.stringify(stateData));
        
        if (stateData.redirect_uri) {
          // Validate redirect URI from state
          const requestOrigin = `${req.protocol}://${req.get('host')}`;
          if (isValidRedirectUri(stateData.redirect_uri, requestOrigin)) {
            customRedirectUri = stateData.redirect_uri;
            console.log('[Auth Callback] ✅ Decoded redirect_uri from state:', customRedirectUri);
          } else {
            console.error('[Auth Callback] ❌ Invalid redirect_uri in state:', stateData.redirect_uri);
          }
        } else {
          console.log('[Auth Callback] ⚠️ No redirect_uri in state data');
        }
      } catch (error) {
        console.error('[Auth Callback] ❌ Failed to decode state parameter:', error);
      }
    } else {
      console.log('[Auth Callback] ⚠️ No state parameter provided in callback');
    }
    
    // Strip port from hostname for strategy lookup
    const strategyHost = req.hostname.split(':')[0];
    passport.authenticate(`replitauth:${strategyHost}`, async (err: any, user: any) => {
      if (err || !user) {
        return res.redirect("/api/login");
      }

      req.login(user, async (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }

        // Check if user has a company
        const dbUser = await storage.getUser(user.claims.sub);
        
        // Check for invite token in session (stored by login route)
        const inviteToken = (req.session as any).inviteToken;
        
        if (inviteToken && dbUser && !dbUser.companyId) {
          // User clicked invite link before signup - join company automatically
          try {
            const company = await storage.getCompanyByInviteToken(inviteToken);
            
            if (company && 
                company.inviteLinkExpiresAt && 
                new Date() <= company.inviteLinkExpiresAt &&
                company.inviteLinkUses < company.inviteLinkMaxUses) {
              
              // Add user to company
              await storage.updateUser(dbUser.id, {
                companyId: company.id,
                role: 'member',
                invitedBy: company.ownerId,
              });

              // Increment invite uses
              await storage.updateCompany(company.id, {
                inviteLinkUses: company.inviteLinkUses + 1,
              });

              // Clear invite token from session
              delete (req.session as any).inviteToken;

              // Check for custom redirect URI (native app deep link) from state
              if (customRedirectUri) {
                console.log('[Auth Callback] 🎫 Generating JWT tokens for native app (company joined)');
                // Generate JWT tokens for native app
                const tokens = await generateTokenPair({
                  id: dbUser.id,
                  email: dbUser.email,
                  displayName: dbUser.displayName || undefined,
                  profilePicture: dbUser.profilePicture || undefined,
                });
                
                const redirectUrl = `${customRedirectUri}?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&expires_in=${tokens.expiresIn}`;
                console.log('[Auth Callback] 🚀 Redirecting to deep link:', `${customRedirectUri}?access_token=***&refresh_token=***&expires_in=${tokens.expiresIn}`);
                return res.redirect(redirectUrl);
              }

              // Redirect to app
              return res.redirect("/");
            }
          } catch (error) {
            console.error('[Auth] Failed to auto-join company via invite:', error);
          }
        }
        
        if (dbUser && !dbUser.companyId) {
          // New user without company and no invite - redirect to company setup
          // For native apps, include this in the deep link
          if (customRedirectUri) {
            console.log('[Auth Callback] 🎫 Generating JWT tokens for native app (new user, needs company)');
            // Generate JWT tokens for native app
            const tokens = await generateTokenPair({
              id: dbUser.id,
              email: dbUser.email,
              displayName: dbUser.displayName || undefined,
              profilePicture: dbUser.profilePicture || undefined,
            });
            
            const redirectUrl = `${customRedirectUri}?needs_company_setup=true&access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&expires_in=${tokens.expiresIn}`;
            console.log('[Auth Callback] 🚀 Redirecting to deep link (with company setup flag):', `${customRedirectUri}?needs_company_setup=true&access_token=***&refresh_token=***&expires_in=${tokens.expiresIn}`);
            return res.redirect(redirectUrl);
          }
          console.log('[Auth Callback] 🌐 New user needs company setup, redirecting to web onboarding');
          return res.redirect("/onboarding/company-setup");
        }

        // Check for custom redirect URI (native app deep link) from state
        if (customRedirectUri) {
          console.log('[Auth Callback] 🎫 Generating JWT tokens for native app (existing user)');
          // Generate JWT tokens for native app
          const tokens = await generateTokenPair({
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.displayName || undefined,
            profilePicture: dbUser.profilePicture || undefined,
          });
          
          const redirectUrl = `${customRedirectUri}?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&expires_in=${tokens.expiresIn}`;
          console.log('[Auth Callback] 🚀 Redirecting to deep link:', `${customRedirectUri}?access_token=***&refresh_token=***&expires_in=${tokens.expiresIn}`);
          return res.redirect(redirectUrl);
        }

        console.log('[Auth Callback] 🌐 User has company, redirecting to web app home');


        // User has company - redirect to app
        return res.redirect("/");
      });
    })(req, res, next);
  });

  // Native App OAuth with PKCE - Step 1: Start Authorization
  app.post("/api/native/oauth/start", authRateLimiter || ((req: any, res: any, next: any) => next()), async (req, res) => {
    try {
      console.log('[Native OAuth Start] 🚀 Initiating PKCE flow for native app');
      
      // Get custom redirect URI from request body
      const { redirect_uri } = req.body;
      
      if (!redirect_uri) {
        console.error('[Native OAuth Start] ❌ Missing redirect_uri in request');
        return res.status(400).json({ error: 'redirect_uri is required' });
      }
      
      // Validate redirect URI (must be custom scheme for native app)
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      if (!isValidRedirectUri(redirect_uri, requestOrigin)) {
        console.error('[Native OAuth Start] ❌ Invalid redirect_uri:', redirect_uri);
        return res.status(400).json({ error: 'Invalid redirect_uri parameter' });
      }
      
      console.log('[Native OAuth Start] ✅ Validated redirect_uri:', redirect_uri);
      
      // Generate PKCE code verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      // Generate a unique state parameter
      const state = randomBytes(32).toString('hex');
      
      console.log('[Native OAuth Start] 🔑 Generated PKCE challenge');
      console.log('[Native OAuth Start] 📦 State parameter:', state);
      
      // Store verifier with state (expires in 10 minutes)
      await storage.storePKCEVerifier(state, codeVerifier, 600000);
      
      // Get OIDC configuration
      const config = await getOidcConfig();
      const strategyHost = req.hostname.split(':')[0];
      
      // Build authorization URL with PKCE
      const authUrl = new URL(config.serverMetadata().authorization_endpoint!);
      authUrl.searchParams.set('client_id', process.env.REPL_ID!);
      authUrl.searchParams.set('redirect_uri', `${requestOrigin}/api/callback`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      // Store redirect_uri in session for callback
      (req.session as any).native_redirect_uri = redirect_uri;
      await new Promise<void>((resolve) => req.session.save(() => resolve()));
      
      console.log('[Native OAuth Start] 🌐 Authorization URL generated');
      console.log('[Native OAuth Start] 🚀 Returning authorization URL to app');
      
      // Return authorization URL to native app
      res.json({
        authorization_url: authUrl.toString(),
        state
      });
      
    } catch (error) {
      console.error('[Native OAuth Start] ❌ Error:', error);
      res.status(500).json({ error: 'Failed to initiate OAuth flow' });
    }
  });

  // Native App OAuth with PKCE - Step 2: Exchange Authorization Code
  app.post("/api/native/oauth/exchange", authRateLimiter || ((req: any, res: any, next: any) => next()), async (req, res) => {
    try {
      console.log('[Native OAuth Exchange] 🔄 Exchanging authorization code for tokens');
      
      const { code, state } = req.body;
      
      if (!code || !state) {
        console.error('[Native OAuth Exchange] ❌ Missing code or state parameter');
        return res.status(400).json({ error: 'code and state are required' });
      }
      
      console.log('[Native OAuth Exchange] 📦 Received state:', state);
      console.log('[Native OAuth Exchange] 🔑 Received code:', code.substring(0, 10) + '...');
      
      // Retrieve stored code verifier
      const codeVerifier = await storage.getPKCEVerifier(state);
      
      if (!codeVerifier) {
        console.error('[Native OAuth Exchange] ❌ No verifier found for state (expired or invalid)');
        return res.status(400).json({ error: 'Invalid or expired state parameter' });
      }
      
      console.log('[Native OAuth Exchange] ✅ Retrieved code verifier from storage');
      
      // Get OIDC configuration
      const config = await getOidcConfig();
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      
      // Exchange authorization code for tokens with Replit
      console.log('[Native OAuth Exchange] 🔄 Exchanging code with Replit OAuth provider');
      
      const tokenResponse = await client.authorizationCodeGrant(
        config,
        new URL(`${requestOrigin}/api/callback`),
        {
          pkceCodeVerifier: codeVerifier,
          expectedState: state,
        },
        code,
        state
      );
      
      console.log('[Native OAuth Exchange] ✅ Successfully exchanged code for Replit tokens');
      
      // Get user claims
      const claims = tokenResponse.claims();
      console.log('[Native OAuth Exchange] 👤 User ID:', claims?.sub);
      console.log('[Native OAuth Exchange] 📧 Email:', claims?.email);
      
      // Upsert user in our database
      const dbUser = await upsertUser(claims);
      
      // Delete used PKCE verifier
      await storage.deletePKCEVerifier(state);
      console.log('[Native OAuth Exchange] 🗑️ Cleaned up PKCE verifier');
      
      // Generate FieldSnaps JWT tokens
      console.log('[Native OAuth Exchange] 🎫 Generating FieldSnaps JWT tokens');
      
      const jwtTokens = await generateTokenPair({
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.displayName || undefined,
        profilePicture: dbUser.profilePicture || undefined,
      });
      
      console.log('[Native OAuth Exchange] ✅ JWT tokens generated successfully');
      console.log('[Native OAuth Exchange] 🚀 Returning tokens to native app');
      
      // Return tokens and user info
      res.json({
        access_token: jwtTokens.accessToken,
        refresh_token: jwtTokens.refreshToken,
        expires_in: jwtTokens.expiresIn,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          displayName: dbUser.displayName,
          profilePicture: dbUser.profilePicture,
          companyId: dbUser.companyId,
          needsCompanySetup: !dbUser.companyId,
        }
      });
      
    } catch (error) {
      console.error('[Native OAuth Exchange] ❌ Error exchanging code:', error);
      res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
  });

  // Development-only login bypass for iOS simulator testing
  app.get("/api/dev-login", async (req, res) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!isDevelopment) {
      return res.status(403).json({ error: "Dev login only available in development" });
    }

    // Get custom redirect URI from query params (for native app deep linking)
    let customRedirectUri = req.query.redirect_uri as string;
    
    // Validate redirect URI if provided
    if (customRedirectUri) {
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      if (!isValidRedirectUri(customRedirectUri, requestOrigin)) {
        console.error('[Dev Login] Invalid redirect_uri rejected:', customRedirectUri);
        return res.status(400).json({ error: 'Invalid redirect_uri parameter' });
      }
      console.log('[Dev Login] Using custom redirect URI:', customRedirectUri);
    }

    // Create mock user data
    const mockUser = {
      claims: {
        sub: 'dev-user-local',
        email: 'dev@fieldsnaps.local',
        first_name: 'Dev',
        last_name: 'User',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      },
      access_token: 'dev-token',
      refresh_token: 'dev-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    // Upsert dev user in database
    await upsertUser(mockUser.claims);

    // Log the user in with the mock session
    req.login(mockUser, async (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: "Failed to create dev session" });
      }

      // Check if user has a company
      const dbUser = await storage.getUser(mockUser.claims.sub);
      
      // Check for invite token in session (for testing invite flows)
      const inviteToken = (req.session as any).inviteToken;
      
      if (inviteToken && dbUser && !dbUser.companyId) {
        // User has invite token - join company automatically
        try {
          const company = await storage.getCompanyByInviteToken(inviteToken);
          
          if (company && 
              company.inviteLinkExpiresAt && 
              new Date() <= company.inviteLinkExpiresAt &&
              company.inviteLinkUses < company.inviteLinkMaxUses) {
            
            // Add user to company
            await storage.updateUser(dbUser.id, {
              companyId: company.id,
              role: 'member',
              invitedBy: company.ownerId,
            });

            // Increment invite uses
            await storage.updateCompany(company.id, {
              inviteLinkUses: company.inviteLinkUses + 1,
            });

            // Clear invite token from session
            delete (req.session as any).inviteToken;

            console.log('[Dev Login] Auto-joined company via invite token');
            
            // Redirect to custom URI if provided (native app)
            if (customRedirectUri) {
              const tokens = await generateTokenPair({
                id: dbUser.id,
                email: dbUser.email,
                displayName: dbUser.displayName || undefined,
                profilePicture: dbUser.profilePicture || undefined,
              });
              
              const redirectUrl = `${customRedirectUri}?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&expires_in=${tokens.expiresIn}`;
              console.log('[Dev Login] Redirecting native app with JWT tokens');
              return res.redirect(redirectUrl);
            }
            return res.redirect("/");
          }
        } catch (error) {
          console.error('[Dev Login] Failed to auto-join company via invite:', error);
        }
      }
      
      if (dbUser && !dbUser.companyId) {
        // Auto-create a dev company for testing
        console.log('[Dev Login] Creating dev company for user');
        
        const devCompany = await storage.createCompany({
          name: 'Dev Company',
          ownerId: dbUser.id,
          subscriptionStatus: 'active', // Give dev company active subscription
        });
        
        // Update user with company and active subscription
        await storage.updateUser(dbUser.id, {
          companyId: devCompany.id,
          role: 'owner',
          subscriptionStatus: 'admin', // Give dev user admin access to all features
        });
        
        console.log('[Dev Login] Dev company created with active subscription');
      } else if (dbUser) {
        // Ensure existing dev user has admin subscription
        if (dbUser.subscriptionStatus !== 'admin') {
          await storage.updateUser(dbUser.id, {
            subscriptionStatus: 'admin',
          });
          console.log('[Dev Login] Updated dev user to admin subscription');
        }
      }

      // Return JWT tokens for native app or redirect for web
      console.log('[Dev Login] Dev user logged in successfully');
      if (customRedirectUri) {
        // For native apps, generate JWT tokens instead of using sessions
        const dbUser = await storage.getUser(mockUser.claims.sub);
        if (!dbUser) {
          return res.status(500).json({ error: "Failed to retrieve user" });
        }

        const tokens = await generateTokenPair({
          id: dbUser.id,
          email: dbUser.email,
          displayName: dbUser.displayName || undefined,
          profilePicture: dbUser.profilePicture || undefined,
        });

        // Redirect with tokens in URL (they'll be saved to iOS Keychain on the client)
        const redirectUrl = `${customRedirectUri}?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&expires_in=${tokens.expiresIn}`;
        console.log('[Dev Login] Redirecting native app with JWT tokens');
        return res.redirect(redirectUrl);
      }
      // Redirect authenticated user to projects page
      return res.redirect("/projects");
    });
  });

  // JWT token refresh endpoint for native apps
  // Exchanges a valid refresh token for a new access token
  app.post("/api/auth/refresh", authRateLimiter || ((req: any, res: any, next: any) => next()), async (req, res) => {
    console.log('[JWT Refresh] Request received');
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      console.error('[JWT Refresh] Missing refresh_token in request');
      return res.status(400).json({ error: 'Missing refresh_token' });
    }

    try {
      // Verify refresh token and extract payload
      const payload = verifyAccessToken(refresh_token);
      if (!payload) {
        console.log('[JWT Refresh] Invalid or expired refresh token');
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Get user from database
      const user = await storage.getUser(payload.sub);
      if (!user) {
        console.error('[JWT Refresh] User not found:', payload.sub);
        return res.status(401).json({ error: 'User not found' });
      }

      // Generate new access token
      const newAccessToken = await refreshJwtAccessToken(refresh_token, {
        id: user.id,
        email: user.email,
        displayName: user.displayName || undefined,
        profilePicture: user.profilePicture || undefined,
      });

      if (!newAccessToken) {
        console.log('[JWT Refresh] Failed to refresh token');
        return res.status(401).json({ error: 'Failed to refresh token' });
      }

      console.log('[JWT Refresh] ✅ Token refreshed successfully');
      return res.json({
        access_token: newAccessToken,
        expires_in: 15 * 60, // 15 minutes in seconds
      });
    } catch (error: any) {
      console.error('[JWT Refresh] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // JWT logout endpoint for native apps
  // Revokes the refresh token and clears authentication
  app.post("/api/auth/logout", authRateLimiter || ((req: any, res: any, next: any) => next()), async (req, res) => {
    console.log('[JWT Logout] Request received');
    const { refresh_token } = req.body;
    
    if (refresh_token) {
      // Revoke the refresh token
      const revoked = await revokeRefreshToken(refresh_token);
      if (revoked) {
        console.log('[JWT Logout] ✅ Refresh token revoked');
      } else {
        console.log('[JWT Logout] ⚠️ Refresh token not found (may have already been revoked)');
      }
    }

    return res.json({ success: true });
  });

  app.get("/api/logout", (req, res) => {
    const user = req.user as any;
    const isDevUser = user?.claims?.sub === 'dev-user-local';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    req.logout((logoutErr) => {
      if (logoutErr) {
        console.error('[Logout] Error during req.logout():', logoutErr);
      }
      
      // Destroy the session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('[Logout] Error destroying session:', destroyErr);
        }
        
        // Clear the session cookie
        res.clearCookie('connect.sid');
        
        // For dev users in development, just redirect to login without OIDC logout
        if (isDevelopment && isDevUser) {
          console.log('[Logout] Dev user logout - redirecting to /login');
          return res.redirect('/login');
        }
        
        // For real OAuth users, end the OIDC session
        const host = req.get('host') || req.hostname;
        const redirectUri = `${req.protocol}://${host}`;
        
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: redirectUri,
          }).href
        );
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Try JWT authentication first (for native apps)
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // First try our internal JWT tokens
    const payload = verifyAccessToken(token);
    
    if (payload) {
      // Valid internal JWT token - create a req.user object compatible with session-based auth
      (req as any).user = {
        claims: {
          sub: payload.sub,
          email: payload.email,
        },
        displayName: payload.displayName,
        profilePicture: payload.profilePicture,
      };
      return next();
    }
    
    // Try Supabase JWT token verification
    try {
      const supabasePayload = await verifySupabaseToken(token);
      
      if (supabasePayload) {
        // Valid Supabase token - get or create user in our database
        const user = await getOrCreateUserFromSupabase(supabasePayload);
        
        if (user) {
          // Create req.user object compatible with session-based auth
          (req as any).user = {
            claims: {
              sub: user.id, // Use our internal user ID
              email: user.email,
            },
            displayName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
            profilePicture: user.profileImageUrl,
            supabaseUserId: supabasePayload.sub, // Also include Supabase ID
            isNewUser: user.isNewUser,
          };
          return next();
        }
      }
    } catch (error) {
      console.error('[Auth] Supabase token verification error:', error);
    }
    
    // Both JWT types failed
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Fall back to session-based authentication (for web)
  const user = req.user as any;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Check if user is authenticated via session
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Dev users (from dev-login) don't have expires_at - allow them in development
  if (user?.claims?.sub === 'dev-user-local' && isDevelopment) {
    return next();
  }

  // For OAuth users, check token expiration
  if (user?.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now <= user.expires_at) {
      return next();
    }

    // Token expired - try to refresh
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  next();
};

// Email whitelist middleware - only allows specific emails to access the app
// All other authenticated users get a 403 Forbidden response
export const isWhitelisted: RequestHandler = async (req, res, next) => {
  const WHITELIST_EMAILS = ['team.abgroup@gmail.com', 'hello@fieldsnaps.com'];
  const userEmail = req.user?.claims?.email;
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isDevUser = req.user?.claims?.sub === 'dev-user-local';
  
  // Allow dev users in development mode
  if (isDevelopment && isDevUser) {
    return next();
  }
  
  if (!userEmail) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  if (WHITELIST_EMAILS.includes(userEmail)) {
    return next();
  }
  
  res.status(403).json({ 
    error: "Access restricted", 
    message: "You're on the waitlist! We'll notify you when FieldSnaps launches."
  });
};

// Combined middleware: authenticated AND whitelisted
// Use this for all protected routes during pre-launch
export const isAuthenticatedAndWhitelisted: RequestHandler = async (req, res, next) => {
  await isAuthenticated(req, res, async () => {
    await isWhitelisted(req, res, next);
  });
};
