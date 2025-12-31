import * as Sentry from "@sentry/react";
import { Capacitor } from "@capacitor/core";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProduction = import.meta.env.PROD;
  const isDisabled = import.meta.env.VITE_DISABLE_SENTRY === 'true';
  
  if (isDisabled) {
    console.log("ℹ️  Sentry disabled via VITE_DISABLE_SENTRY environment variable");
    return;
  }
  
  if (!dsn) {
    console.warn("⚠️  Sentry frontend DSN not configured");
    return;
  }

  if (!isProduction && !import.meta.env.VITE_SENTRY_ENABLE_DEV) {
    console.log("ℹ️  Sentry disabled in development (set VITE_SENTRY_ENABLE_DEV=true to enable)");
    return;
  }

  const isNative = Capacitor.isNativePlatform();

  Sentry.init({
    dsn,
    environment: isNative ? 'mobile' : import.meta.env.MODE,
    
    tracePropagationTargets: [
      /^(?!.*\/api\/auth).*$/,
      /^(?!.*supabase\.co).*$/,
      /^(?!.*accounts\.google\.com).*$/,
      /^(?!.*appleid\.apple\.com).*$/,
    ],
    
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
    
    tracesSampleRate: 0.2,
    
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    
    release: import.meta.env.VITE_APP_VERSION || "1.0.0",
    
    beforeSend(event, hint) {
      const blocklist = [
        'did not match expected pattern',
        'OAuth callback',
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        'authorization',
        'auth/callback',
        'supabase',
      ];
      
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          const errorLower = error.message.toLowerCase();
          if (blocklist.some(msg => errorLower.includes(msg.toLowerCase()))) {
            console.log('[Sentry] Filtered auth-related error:', error.message.substring(0, 100));
            return null;
          }
        }
      }
      
      if (event.message && blocklist.some(msg => event.message?.toLowerCase().includes(msg.toLowerCase()))) {
        console.log('[Sentry] Filtered auth-related message');
        return null;
      }
      
      return event;
    },
  });

  console.log("✅ Sentry initialized for frontend", isNative ? "(mobile)" : "(web)");
}

export function setSentryUser(user: { id: string; email?: string; subscriptionStatus?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export function addSentryBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    level: "info",
    data,
  });
}

export function captureSentryError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

export { Sentry };
