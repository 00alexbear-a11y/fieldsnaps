import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProduction = import.meta.env.PROD;
  
  if (!dsn) {
    console.warn("⚠️  Sentry frontend DSN not configured");
    return;
  }

  if (!isProduction && !import.meta.env.VITE_SENTRY_ENABLE_DEV) {
    console.log("ℹ️  Sentry disabled in development (set VITE_SENTRY_ENABLE_DEV=true to enable)");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    
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
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          if (error.message.includes("Network request failed") ||
              error.message.includes("Failed to fetch") ||
              error.message.includes("Load failed")) {
            return null;
          }
        }
      }
      return event;
    },
  });

  console.log("✅ Sentry initialized for frontend");
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
