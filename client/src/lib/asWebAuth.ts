/**
 * ASWebAuthenticationSession Plugin for Capacitor
 * 
 * This plugin provides access to iOS's ASWebAuthenticationSession,
 * which is the modern, recommended way to handle OAuth flows in native apps.
 * 
 * Key benefits over SFSafariViewController:
 * - Automatically dismisses after OAuth callback
 * - Apple-recommended for OAuth
 * - Better security and user experience
 */

import { registerPlugin } from '@capacitor/core';

export interface ASWebAuthPlugin {
  authenticate(options: {
    url: string;
    callbackScheme: string;
  }): Promise<{
    url: string;
    params?: Record<string, string>;
  }>;
}

const ASWebAuth = registerPlugin<ASWebAuthPlugin>('ASWebAuthPlugin', {
  web: () => {
    // Fallback for web platform - just redirect
    return {
      authenticate: async (options: { url: string }) => {
        window.location.href = options.url;
        return { url: '' };
      },
    };
  },
});

export default ASWebAuth;
