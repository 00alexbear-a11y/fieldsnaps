import { initSentry, Sentry, sentryUserMiddleware, sentryErrorMiddleware } from "./sentry";
initSentry();

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { billingService } from "./billing";
import { initChunkedUpload } from "./chunkedUpload";

const app = express();

// Export CORS configuration for use in API routes only
// Static assets don't need CORS - only API endpoints do
export const corsConfig = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Allow Capacitor/Ionic WebView origins (exact protocol match)
    if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
      return callback(null, true);
    }
    
    // Parse origin and validate localhost/127.0.0.1 strictly
    try {
      const url = new URL(origin);
      
      // Allow exact localhost/127.0.0.1 hosts (not subdomains)
      if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
          (url.protocol === 'http:' || url.protocol === 'https:')) {
        return callback(null, true);
      }
      
      // Allow production domains
      if (process.env.NODE_ENV === 'production') {
        if (url.hostname === 'fieldsnaps.com' || 
            url.hostname.endsWith('.fieldsnaps.com')) {
          return callback(null, true);
        }
      }
      
      // Also check specific allowed origins from environment
      const allowedOrigins = [
        'https://fieldsnaps.com',
        process.env.APP_URL,
      ].filter(Boolean);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid URL, reject
      return callback(new Error('Invalid origin'));
    }
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

// Enable gzip compression for all responses - reduces payload size by up to 70%
app.use(compression());


// Security headers middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.googleapis.com", // Vite + Google Maps
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind + Google Fonts
    "img-src 'self' data: blob: https: https://*.googleapis.com https://*.gstatic.com", // Google Maps tiles
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.fieldsnaps.com https://api.stripe.com https://maps.googleapis.com https://*.supabase.co https://*.googleapis.com",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  
  next();
});

// Stripe webhook endpoint - MUST be before express.json() to preserve raw body
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig || typeof sig !== 'string') {
      console.error('[Webhook] Missing Stripe signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    try {
      // Verify webhook signature and parse event
      const event = billingService.parseWebhookEvent(req.body, sig);
      console.log(`[Webhook] Received event: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const userId = session.metadata?.userId;
          const customerId = session.customer;
          
          if (!userId) {
            console.error('[Webhook] No userId in session metadata');
            break;
          }

          // Update user with Stripe customer ID
          await storage.updateUser(userId, {
            stripeCustomerId: customerId as string,
          });
          
          console.log(`[Webhook] Checkout completed for user ${userId}`);
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer;
          
          // Find user by Stripe customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (!user) {
            console.error(`[Webhook] No user found for customer ${customerId}`);
            break;
          }

          // Get subscription to determine status
          const subscriptionId = invoice.subscription;
          if (subscriptionId) {
            const subscription = await billingService.retrieveSubscription(subscriptionId);
            const newStatus = billingService.mapStripeStatusToUserStatus(subscription.status);
            
            // Clear pastDueSince on successful payment
            await storage.updateUser(user.id, {
              subscriptionStatus: newStatus,
              pastDueSince: null,
            });
            
            console.log(`[Webhook] Payment succeeded for user ${user.id}, status: ${newStatus}`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer;
          
          // Find user by Stripe customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (!user) {
            console.error(`[Webhook] No user found for customer ${customerId}`);
            break;
          }

          // Set pastDueSince to track when grace period starts
          await storage.updateUser(user.id, {
            subscriptionStatus: 'past_due',
            pastDueSince: new Date(),
          });
          
          console.log(`[Webhook] Payment failed for user ${user.id}, set to past_due`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;
          
          // Find user by Stripe customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (!user) {
            console.error(`[Webhook] No user found for customer ${customerId}`);
            break;
          }

          // Set status to canceled and clear pastDueSince
          await storage.updateUser(user.id, {
            subscriptionStatus: 'canceled',
            pastDueSince: null,
          });
          
          console.log(`[Webhook] Subscription canceled for user ${user.id}`);
          break;
        }

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[Webhook] Error processing webhook:', error);
      return res.status(400).json({ error: error.message });
    }
  }
);

// Body parsing with size limits to prevent abuse
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Sentry error handler (must be before generic error handler)
  if (process.env.SENTRY_DSN) {
    app.use(sentryErrorMiddleware);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('[Error]', err.message);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize chunked upload system
    initChunkedUpload()
      .then(() => log('Chunked upload system initialized'))
      .catch((err) => console.error('Chunked upload init failed:', err));
    
    // Seed predefined trade tags on server start
    storage.seedPredefinedTags()
      .then(() => log('Predefined tags seeded'))
      .catch((err) => console.error('Tag seeding failed:', err));
    
    // Run trash cleanup on server start
    storage.cleanupOldDeletedItems()
      .then(() => log('Trash cleanup completed'))
      .catch((err) => console.error('Trash cleanup failed:', err));
    
    // Schedule daily trash cleanup (every 24 hours)
    setInterval(() => {
      storage.cleanupOldDeletedItems()
        .then(() => log('Scheduled trash cleanup completed'))
        .catch((err) => console.error('Scheduled trash cleanup failed:', err));
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  });
})();
