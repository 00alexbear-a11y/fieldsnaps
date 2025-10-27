import { randomBytes, createHash } from 'crypto';

/**
 * Generates a cryptographically secure PKCE code verifier
 * Following RFC 7636 specifications
 * 
 * @returns Base64URL-encoded random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (256 bits) - results in 43-char base64url string
  const verifier = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return verifier;
}

/**
 * Generates a PKCE code challenge from a code verifier
 * Uses SHA-256 hash as per RFC 7636
 * 
 * @param verifier - The code verifier string
 * @returns Base64URL-encoded SHA-256 hash of the verifier
 */
export function generateCodeChallenge(verifier: string): string {
  // SHA-256 hash the verifier
  const hash = createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return hash;
}

/**
 * Validates a code verifier against a code challenge
 * Used during token exchange to verify PKCE flow integrity
 * 
 * @param verifier - The code verifier to validate
 * @param challenge - The expected code challenge
 * @returns True if verifier matches the challenge
 */
export function validatePKCE(verifier: string, challenge: string): boolean {
  const computedChallenge = generateCodeChallenge(verifier);
  return computedChallenge === challenge;
}
