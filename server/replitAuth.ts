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
    passport.authenticate(`replitauth:${strategyHost}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // Use req.get('host') which already includes port if present
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
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Allow skip auth in development mode for testing
  const skipAuth = req.headers['x-skip-auth'] === 'true' || req.query.skipAuth === 'true';
  if (process.env.NODE_ENV === 'development' && skipAuth) {
    // Set up mock user for dev bypass
    (req as any).user = {
      claims: {
        sub: 'dev-user'
      }
    };
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
