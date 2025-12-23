import jwt from 'jsonwebtoken';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL) {
  console.warn('[SupabaseAuth] SUPABASE_URL not configured');
}

export interface SupabaseTokenPayload {
  sub: string;
  email?: string;
  phone?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
    email?: string;
  };
  role?: string;
  aal?: string;
  amr?: Array<{ method: string; timestamp: number }>;
  session_id?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

let cachedJwks: { keys: any[] } | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000;

async function getJwks(): Promise<{ keys: any[] }> {
  const now = Date.now();
  if (cachedJwks && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    return cachedJwks;
  }

  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL not configured');
  }

  const jwksUrl = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  
  try {
    const response = await fetch(jwksUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }
    cachedJwks = await response.json();
    jwksCacheTime = now;
    console.log('[SupabaseAuth] JWKS cached successfully');
    return cachedJwks!;
  } catch (error) {
    console.error('[SupabaseAuth] Error fetching JWKS:', error);
    throw error;
  }
}

export async function verifySupabaseToken(token: string): Promise<SupabaseTokenPayload | null> {
  if (!token) {
    return null;
  }

  try {
    if (SUPABASE_JWT_SECRET) {
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
        algorithms: ['HS256'],
      }) as SupabaseTokenPayload;
      
      return decoded;
    }

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      console.log('[SupabaseAuth] Failed to decode token');
      return null;
    }

    const jwks = await getJwks();
    const kid = decoded.header.kid;
    const key = jwks.keys.find(k => k.kid === kid);
    
    if (!key) {
      console.log('[SupabaseAuth] No matching key found in JWKS');
      return null;
    }

    const publicKey = await importJwk(key);
    
    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as SupabaseTokenPayload;

    return verified;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[SupabaseAuth] Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[SupabaseAuth] Invalid token:', error.message);
    } else {
      console.error('[SupabaseAuth] Token verification error:', error);
    }
    return null;
  }
}

async function importJwk(jwk: any): Promise<string> {
  const crypto = await import('crypto');
  const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return keyObject.export({ type: 'spki', format: 'pem' }) as string;
}

export async function getOrCreateUserFromSupabase(payload: SupabaseTokenPayload): Promise<{
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  companyId: string | null;
  role: string | null;
  isNewUser: boolean;
} | null> {
  const supabaseUserId = payload.sub;
  const email = payload.email || payload.user_metadata?.email;
  
  if (!supabaseUserId) {
    console.error('[SupabaseAuth] No sub claim in token');
    return null;
  }

  console.log('[SupabaseAuth] getOrCreateUserFromSupabase called with:', { supabaseUserId, email });

  try {
    let [existingBySupabaseId] = await db.select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);

  if (existingBySupabaseId) {
    return {
      id: existingBySupabaseId.id,
      email: existingBySupabaseId.email,
      firstName: existingBySupabaseId.firstName,
      lastName: existingBySupabaseId.lastName,
      profileImageUrl: existingBySupabaseId.profileImageUrl,
      companyId: existingBySupabaseId.companyId,
      role: existingBySupabaseId.role,
      isNewUser: false,
    };
  }

  if (email) {
    const [existingByEmail] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingByEmail) {
      const provider = payload.app_metadata?.provider || 'supabase';
      await db.update(users)
        .set({ 
          supabaseUserId,
          authProvider: provider,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail.id));

      console.log(`[SupabaseAuth] Linked existing user ${existingByEmail.id} to Supabase ID ${supabaseUserId}`);

      return {
        id: existingByEmail.id,
        email: existingByEmail.email,
        firstName: existingByEmail.firstName,
        lastName: existingByEmail.lastName,
        profileImageUrl: existingByEmail.profileImageUrl,
        companyId: existingByEmail.companyId,
        role: existingByEmail.role,
        isNewUser: false,
      };
    }
  }

  const fullName = payload.user_metadata?.full_name || payload.user_metadata?.name || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(' ') || null;
  const profileImageUrl = payload.user_metadata?.avatar_url || payload.user_metadata?.picture || null;
  const provider = payload.app_metadata?.provider || 'supabase';

  const result = await db.insert(users).values({
    email: email || null,
    firstName,
    lastName,
    profileImageUrl,
    supabaseUserId,
    authProvider: provider,
    role: 'member',
    subscriptionStatus: 'trial',
  }).returning();
  
  const newUser = Array.isArray(result) ? result[0] : (result as any).rows?.[0];

  console.log(`[SupabaseAuth] Created new user ${newUser.id} from Supabase ID ${supabaseUserId}`);

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      profileImageUrl: newUser.profileImageUrl,
      companyId: newUser.companyId,
      role: newUser.role,
      isNewUser: true,
    };
  } catch (error: any) {
    console.error('[SupabaseAuth] Error in getOrCreateUserFromSupabase:', error.message, error.stack);
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}
