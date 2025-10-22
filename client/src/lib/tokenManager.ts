import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { jwtDecode } from 'jwt-decode';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

interface JWTPayload {
  sub: string; // user ID
  email: string;
  displayName?: string;
  profilePicture?: string;
  type: 'access' | 'refresh';
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
}

class TokenManager {
  /**
   * Store tokens securely in iOS Keychain
   */
  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      console.log('[TokenManager] Storing tokens in iOS Keychain');
      
      await SecureStorage.set(ACCESS_TOKEN_KEY, accessToken);
      await SecureStorage.set(REFRESH_TOKEN_KEY, refreshToken);

      console.log('[TokenManager] ✅ Tokens stored successfully');
    } catch (error) {
      console.error('[TokenManager] Failed to store tokens:', error);
      throw error;
    }
  }

  /**
   * Get access token from iOS Keychain
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const result = await SecureStorage.get(ACCESS_TOKEN_KEY);
      if (!result) return null;
      
      // SecureStorage auto-JSON-encodes strings, so parse it if needed
      if (typeof result === 'string' && result.startsWith('"') && result.endsWith('"')) {
        return JSON.parse(result);
      }
      
      return result as string;
    } catch (error) {
      // Key not found is expected when user is not logged in
      console.log('[TokenManager] No access token found');
      return null;
    }
  }

  /**
   * Get refresh token from iOS Keychain
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      const result = await SecureStorage.get(REFRESH_TOKEN_KEY);
      if (!result) return null;
      
      // SecureStorage auto-JSON-encodes strings, so parse it if needed
      if (typeof result === 'string' && result.startsWith('"') && result.endsWith('"')) {
        return JSON.parse(result);
      }
      
      return result as string;
    } catch (error) {
      console.log('[TokenManager] No refresh token found');
      return null;
    }
  }

  /**
   * Decode and validate access token
   * Returns payload if valid, null if expired or invalid
   */
  decodeAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        console.log('[TokenManager] Access token expired');
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('[TokenManager] Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if access token is expired or about to expire (within 60 seconds)
   */
  async isAccessTokenValid(): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) return false;

    const payload = this.decodeAccessToken(token);
    if (!payload) return false;

    // Token is valid and not expired
    const now = Math.floor(Date.now() / 1000);
    const isValid = payload.exp > now + 60; // Valid if expires in more than 60 seconds

    console.log('[TokenManager] Access token valid:', isValid);
    return isValid;
  }

  /**
   * Refresh access token using refresh token
   * Returns new access token or null if refresh failed
   */
  async refreshAccessToken(): Promise<string | null> {
    try {
      console.log('[TokenManager] Refreshing access token...');
      
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        console.log('[TokenManager] No refresh token available');
        return null;
      }

      // Call backend refresh endpoint
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        console.error('[TokenManager] Failed to refresh token:', response.status);
        return null;
      }

      const data = await response.json();
      const newAccessToken = data.access_token;

      // Store new access token
      await SecureStorage.set(ACCESS_TOKEN_KEY, newAccessToken);

      console.log('[TokenManager] ✅ Access token refreshed successfully');
      return newAccessToken;
    } catch (error) {
      console.error('[TokenManager] Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * This is the main method to use when making API calls
   */
  async getValidAccessToken(): Promise<string | null> {
    // Check if current token is valid
    const isValid = await this.isAccessTokenValid();
    if (isValid) {
      return this.getAccessToken();
    }

    // Token is expired or about to expire - refresh it
    console.log('[TokenManager] Access token expired or expiring soon, refreshing...');
    const newToken = await this.refreshAccessToken();
    
    if (!newToken) {
      // Refresh failed - user needs to login again
      console.log('[TokenManager] ❌ Token refresh failed, user must login');
      await this.clearTokens();
      return null;
    }

    return newToken;
  }

  /**
   * Clear all tokens (logout)
   */
  async clearTokens(): Promise<void> {
    try {
      console.log('[TokenManager] Clearing tokens from iOS Keychain');
      
      await SecureStorage.remove(ACCESS_TOKEN_KEY);
      await SecureStorage.remove(REFRESH_TOKEN_KEY);

      console.log('[TokenManager] ✅ Tokens cleared');
    } catch (error) {
      console.error('[TokenManager] Error clearing tokens:', error);
    }
  }

  /**
   * Get user info from stored access token
   */
  async getUserInfo(): Promise<{
    id: string;
    email: string;
    displayName?: string;
    profilePicture?: string;
  } | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    const payload = this.decodeAccessToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      profilePicture: payload.profilePicture,
    };
  }

  /**
   * Check if user is logged in (has valid tokens)
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }

  /**
   * Logout user: Revoke refresh token on server and clear all local tokens
   */
  async logout(): Promise<void> {
    try {
      console.log('[TokenManager] Logging out user...');

      // Get refresh token before clearing
      const refreshToken = await this.getRefreshToken();

      // Clear tokens from iOS Keychain first
      await this.clearTokens();

      // Try to revoke refresh token on server (best effort - don't fail if it fails)
      if (refreshToken) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              refresh_token: refreshToken,
            }),
          });
          console.log('[TokenManager] ✅ Refresh token revoked on server');
        } catch (error) {
          // Server revocation failed, but local tokens are already cleared
          console.error('[TokenManager] Failed to revoke token on server:', error);
        }
      }

      console.log('[TokenManager] ✅ Logout complete');
    } catch (error) {
      console.error('[TokenManager] Error during logout:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();
