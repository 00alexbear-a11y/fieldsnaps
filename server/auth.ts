import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { verifyAccessToken, refreshAccessToken as refreshJwtAccessToken, revokeRefreshToken } from "./jwtService";
import { verifySupabaseToken, getOrCreateUserFromSupabase } from "./supabaseAuth";
import { setUserContext, clearUserContext } from "./sentry";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express, authRateLimiter?: any) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // JWT token refresh endpoint for native apps
  app.post("/api/auth/refresh", authRateLimiter || ((req: any, res: any, next: any) => next()), async (req, res) => {
    console.log('[JWT Refresh] Request received');
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      console.error('[JWT Refresh] Missing refresh_token in request');
      return res.status(400).json({ error: 'Missing refresh_token' });
    }

    try {
      const payload = verifyAccessToken(refresh_token);
      if (!payload) {
        console.log('[JWT Refresh] Invalid or expired refresh token');
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const user = await storage.getUser(payload.sub);
      if (!user) {
        console.error('[JWT Refresh] User not found:', payload.sub);
        return res.status(401).json({ error: 'User not found' });
      }

      const newAccessToken = await refreshJwtAccessToken(refresh_token, {
        id: user.id,
        email: user.email || '',
        displayName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
        profilePicture: user.profileImageUrl || undefined,
      });

      if (!newAccessToken) {
        console.log('[JWT Refresh] Failed to refresh token');
        return res.status(401).json({ error: 'Failed to refresh token' });
      }

      console.log('[JWT Refresh] Token refreshed successfully');
      return res.json({
        access_token: newAccessToken,
        expires_in: 15 * 60,
      });
    } catch (error: any) {
      console.error('[JWT Refresh] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // JWT logout endpoint
  app.post("/api/auth/logout", authRateLimiter || ((req: any, res: any, next: any) => next()), async (req, res) => {
    console.log('[JWT Logout] Request received');
    const { refresh_token } = req.body;
    
    if (refresh_token) {
      const revoked = await revokeRefreshToken(refresh_token);
      if (revoked) {
        console.log('[JWT Logout] Refresh token revoked');
      }
    }

    return res.json({ success: true });
  });

  // Session logout endpoint (clears session cookie)
  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Logout] Error destroying session:', err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Try internal JWT tokens first
    const payload = verifyAccessToken(token);
    
    if (payload) {
      (req as any).user = {
        claims: {
          sub: payload.sub,
          email: payload.email,
        },
        displayName: payload.displayName,
        profilePicture: payload.profilePicture,
      };
      setUserContext({ id: payload.sub, email: payload.email || undefined });
      res.on('finish', () => clearUserContext());
      return next();
    }
    
    // Try Supabase JWT token
    try {
      const supabasePayload = await verifySupabaseToken(token);
      
      if (supabasePayload) {
        const user = await getOrCreateUserFromSupabase(supabasePayload);
        
        if (user) {
          (req as any).user = {
            claims: {
              sub: user.id,
              email: user.email,
            },
            displayName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
            profilePicture: user.profileImageUrl,
            supabaseUserId: supabasePayload.sub,
            isNewUser: user.isNewUser,
          };
          setUserContext({ id: user.id, email: user.email || undefined, companyId: user.companyId || undefined });
          res.on('finish', () => clearUserContext());
          return next();
        }
      }
    } catch (error) {
      console.error('[Auth] Supabase token verification error:', error);
    }
    
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Fall back to session-based authentication
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};

// Email whitelist middleware
export const isWhitelisted: RequestHandler = async (req, res, next) => {
  const WHITELIST_EMAILS = ['team.abgroup@gmail.com', 'hello@fieldsnaps.com', 'alexmbear@yahoo.com'];
  const userEmail = (req as any).user?.claims?.email;
  
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
export const isAuthenticatedAndWhitelisted: RequestHandler = async (req, res, next) => {
  await isAuthenticated(req, res, async () => {
    await isWhitelisted(req, res, next);
  });
};
