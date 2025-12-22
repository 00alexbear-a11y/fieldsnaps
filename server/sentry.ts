import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn("⚠️  Sentry DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "production",
    
    tracesSampleRate: 0.2,
    
    release: process.env.npm_package_version || "1.0.0",
    
    beforeSend(event) {
      if (event.request) {
        event.request.cookies = undefined;
      }
      return event;
    },
  });

  console.log("✅ Sentry initialized for backend");
}

export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

export function setUserContext(user: { id: string; email?: string; companyId?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
}

export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    level: "info",
    data,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export function sentryUserMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.claims?.sub) {
    Sentry.setUser({
      id: user.claims.sub,
      email: user.claims.email,
    });
  }
  next();
}

export function sentryErrorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  Sentry.captureException(err, {
    extra: {
      method: req.method,
      path: req.path,
      query: req.query,
      userId: (req as any).user?.claims?.sub,
    },
  });
  next(err);
}

export { Sentry };
