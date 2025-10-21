import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { emailService } from "./email";

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
      secure: isProduction,
      sameSite: isProduction ? 'lax' : 'lax',
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

export async function setupAuth(app: Express) {
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
    
    // Strip port from hostname for strategy lookup
    const strategyHost = req.hostname.split(':')[0];
    passport.authenticate(`replitauth:${strategyHost}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
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

              // Redirect to app
              return res.redirect("/");
            }
          } catch (error) {
            console.error('[Auth] Failed to auto-join company via invite:', error);
          }
        }
        
        if (dbUser && !dbUser.companyId) {
          // New user without company and no invite - redirect to company setup
          return res.redirect("/onboarding/company-setup");
        }

        // User has company - redirect to app
        return res.redirect("/");
      });
    })(req, res, next);
  });

  // Development-only login bypass for iOS simulator testing
  app.get("/api/dev-login", async (req, res) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!isDevelopment) {
      return res.status(403).json({ error: "Dev login only available in development" });
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
            return res.redirect("/");
          }
        } catch (error) {
          console.error('[Dev Login] Failed to auto-join company via invite:', error);
        }
      }
      
      if (dbUser && !dbUser.companyId) {
        // Redirect to company setup
        console.log('[Dev Login] Redirecting to company setup');
        return res.redirect("/onboarding/company-setup");
      }

      // Redirect to app
      console.log('[Dev Login] Dev user logged in successfully');
      return res.redirect("/");
    });
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
  const user = req.user as any;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Try real authentication first
  if (req.isAuthenticated() && user?.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now <= user.expires_at) {
      return next();
    }

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

  // No valid session - user must authenticate via /api/login or /api/dev-login (development only)
  return res.status(401).json({ message: "Unauthorized" });
};
