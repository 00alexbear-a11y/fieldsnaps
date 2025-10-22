import jwt from 'jsonwebtoken';
import { db } from './db';
import { refreshTokens } from '../shared/schema';
import { eq, lt } from 'drizzle-orm';

// JWT configuration - REQUIRE JWT_SECRET for production security
if (!process.env.JWT_SECRET) {
  throw new Error('[JWT] FATAL: JWT_SECRET environment variable must be set. Generate one with: openssl rand -hex 64');
}

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

console.log('[JWT] Service initialized with database-backed refresh token storage');

export interface TokenPayload {
  sub: string; // user ID
  email: string;
  displayName?: string;
  profilePicture?: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Cleanup expired refresh tokens from database
 * Should be called periodically to prevent storage bloat
 */
export async function cleanupExpiredTokens() {
  try {
    const result = await db.delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id });
    
    if (result.length > 0) {
      console.log(`[JWT] Cleaned up ${result.length} expired refresh tokens`);
    }
  } catch (error) {
    console.error('[JWT] Error cleaning up expired tokens:', error);
  }
}

// Run cleanup on startup and every hour
cleanupExpiredTokens();
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

/**
 * Generate both access and refresh tokens for a user
 */
export async function generateTokenPair(user: {
  id: string;
  email: string;
  displayName?: string;
  profilePicture?: string;
}): Promise<TokenPair> {
  // Access token payload (short-lived)
  const accessPayload: TokenPayload = {
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    profilePicture: user.profilePicture,
    type: 'access',
  };

  // Refresh token payload (long-lived)
  const refreshPayload: TokenPayload = {
    sub: user.id,
    email: user.email,
    type: 'refresh',
  };

  const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
  
  try {
    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: user.id,
      expiresAt,
    });
    console.log(`[JWT] Stored refresh token for user ${user.id} (expires: ${expiresAt.toISOString()})`);
  } catch (error) {
    console.error('[JWT] Error storing refresh token:', error);
    throw new Error('Failed to store refresh token');
  }

  console.log(`[JWT] Generated token pair for user ${user.id}`);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    
    // Ensure it's an access token
    if (decoded.type !== 'access') {
      console.log('[JWT] Token type mismatch: expected access, got', decoded.type);
      return null;
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[JWT] Access token expired');
    } else {
      console.log('[JWT] Access token verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    
    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      console.log('[JWT] Token type mismatch: expected refresh, got', decoded.type);
      return null;
    }

    // Check if token exists in database
    const [stored] = await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1);
    
    if (!stored) {
      console.log('[JWT] Refresh token not found in database (may have been revoked)');
      return null;
    }

    // Check if token is expired in database
    if (stored.expiresAt < new Date()) {
      console.log('[JWT] Refresh token expired in database');
      // Clean up expired token
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
      return null;
    }

    // Update last used timestamp
    await db.update(refreshTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(refreshTokens.token, token));

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[JWT] Refresh token expired');
    } else {
      console.log('[JWT] Refresh token verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Refresh an access token using a valid refresh token
 */
export function refreshAccessToken(refreshToken: string, user: {
  id: string;
  email: string;
  displayName?: string;
  profilePicture?: string;
}): string | null {
  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return null;
  }

  // Ensure refresh token belongs to this user
  if (payload.sub !== user.id) {
    console.log('[JWT] Refresh token user mismatch');
    return null;
  }

  // Generate new access token
  const accessPayload: TokenPayload = {
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    profilePicture: user.profilePicture,
    type: 'access',
  };

  const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  console.log(`[JWT] Refreshed access token for user ${user.id}`);

  return accessToken;
}

/**
 * Revoke a refresh token (logout)
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    const result = await db.delete(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .returning({ id: refreshTokens.id });
    
    const deleted = result.length > 0;
    if (deleted) {
      console.log('[JWT] Refresh token revoked');
    }
    return deleted;
  } catch (error) {
    console.error('[JWT] Error revoking refresh token:', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
  try {
    const result = await db.delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId))
      .returning({ id: refreshTokens.id });
    
    console.log(`[JWT] Revoked ${result.length} refresh tokens for user ${userId}`);
    return result.length;
  } catch (error) {
    console.error('[JWT] Error revoking user tokens:', error);
    return 0;
  }
}

