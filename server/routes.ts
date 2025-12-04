import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { insertProjectSchema, insertPhotoSchema, insertPhotoAnnotationSchema, insertCommentSchema, insertShareSchema, insertTagSchema, insertPhotoTagSchema, insertPdfSchema, insertTaskSchema, insertTodoSchema, batchTodoSchema, insertWaitlistSchema, insertGeofenceSchema, insertLocationLogSchema, insertUserPermissionSchema, insertTimeEntryEditSchema } from "../shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, isAuthenticatedAndWhitelisted } from "./auth";
import { setupWebAuthn } from "./webauthn";
import { handleError, errors } from "./errorHandler";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { billingService } from "./billing";
import { emailService } from "./email";
import { cacheMiddleware, invalidateUserCache, invalidateCachePattern } from "./cache";
import { fieldFilterMiddleware } from "./fieldFilter";
import { geocodeAddress } from "./geocoding";
import { Client } from "@replit/object-storage";
import {
  initChunkedUpload,
  initUploadSession,
  uploadChunk,
  getUploadStatus,
  cancelUpload,
  chunkUpload,
  assembleChunks,
  cleanupUploadSession,
  validateUploadSession
} from "./chunkedUpload";
import { uploadMetrics } from "./uploadMetrics";
import { corsConfig } from "./index";

// Configure multer for file uploads with strict validation
const ALLOWED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  // Videos
  'video/mp4',
  'video/quicktime', // .mov files
  'video/x-msvideo', // .avi files  
  'video/webm',
  // PDFs
  'application/pdf',
];

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for processing
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    files: 2, // Allow photo + thumbnail upload
  },
  fileFilter: (req, file, cb) => {
    // Validate MIME type against whitelist
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`));
    }
  },
});

// Rate limiting for upload endpoints - prevents abuse from mobile clients
// Key by authenticated user ID instead of IP to support multiple workers on same site
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 uploads per window per user
  message: 'Too many upload requests, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Use authenticated user ID as rate limit key (no IP fallback to avoid IPv6 warnings)
    // Upload endpoints require authentication, so this should always have a value
    return req.user?.claims?.sub || 'unauthenticated';
  },
  skip: (req: any) => {
    // Skip rate limiting in development mode
    return process.env.NODE_ENV === 'development';
  },
});

// Rate limiting for auth endpoints - prevents brute force attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 auth attempts per window per IP
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => {
    // Skip rate limiting in development mode
    return process.env.NODE_ENV === 'development';
  },
});

// Rate limiting for location log endpoints - prevents abuse from geofencing plugin
// 12 requests per minute = one ping every 5 minutes per user with buffer
const locationLogRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12, // Max 12 location pings per minute per user
  message: 'Too many location updates, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.claims?.sub || 'anonymous';
  },
  skip: (req: any) => {
    // Skip rate limiting in development mode
    return process.env.NODE_ENV === 'development';
  },
});

// UUID validation middleware for route parameters

const validateUuidParam = (paramName: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const schema = z.object({
      [paramName]: z.string().uuid(`Invalid ${paramName} format`),
    });
    
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      handleError(res, error);
    }
  };
};

// Validate multiple UUID parameters
const validateUuidParams = (...paramNames: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const schemaObject: Record<string, z.ZodString> = {};
    paramNames.forEach(name => {
      schemaObject[name] = z.string().uuid(`Invalid ${name} format`);
    });
    const schema = z.object(schemaObject);
    
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      handleError(res, error);
    }
  };
};

// Type for authenticated user with company (narrowed companyId)
type CompanyUser = NonNullable<Awaited<ReturnType<typeof storage.getUser>>> & {
  companyId: string;
};

// Helper to get authenticated user with company
async function getUserWithCompany(req: any, res: any): Promise<CompanyUser | null> {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const user = await storage.getUser(userId);
  if (!user || !user.companyId) {
    res.status(403).json({ error: "User must belong to a company" });
    return null;
  }

  // Type assertion is safe because we checked !user.companyId above
  return user as CompanyUser;
}

function isCompanyAdmin(user: any): boolean {
  return user.role === 'owner';
}

function assertCompanyAdmin(user: any, res: any): boolean {
  if (!isCompanyAdmin(user)) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// Generic helper to verify company access for any resource
async function verifyCompanyAccess(req: any, res: any, resourceCompanyId: string, user?: any): Promise<boolean> {
  // Use provided user or fetch it
  const validUser = user || await getUserWithCompany(req, res);
  if (!validUser) return false;

  if (resourceCompanyId !== validUser.companyId) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }

  return true;
}

// Helper to verify company access for projects
async function verifyProjectCompanyAccess(req: any, res: any, projectId: string): Promise<boolean> {
  const user = await getUserWithCompany(req, res);
  if (!user) return false;

  const project = await storage.getProject(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return false;
  }

  if (!project.companyId) {
    res.status(500).json({ error: "Project has no company association" });
    return false;
  }

  return verifyCompanyAccess(req, res, project.companyId, user);
}

// Helper to verify company access for photos
// Returns photo and project objects to avoid duplicate database queries
async function verifyPhotoCompanyAccess(
  req: any, 
  res: any, 
  photoId: string
): Promise<{ authorized: boolean; photo: any | null; project: any | null }> {
  const photo = await storage.getPhoto(photoId);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return { authorized: false, photo: null, project: null };
  }

  const project = await storage.getProject(photo.projectId);
  if (!project || !project.companyId) {
    res.status(404).json({ error: "Project not found" });
    return { authorized: false, photo, project: null };
  }

  const authorized = await verifyCompanyAccess(req, res, project.companyId);
  return { authorized, photo, project };
}

// Helper to verify company access for annotations
async function verifyAnnotationCompanyAccess(req: any, res: any, annotationId: string): Promise<boolean> {
  const annotation = await storage.getPhotoAnnotation(annotationId);
  if (!annotation) {
    res.status(404).json({ error: "Annotation not found" });
    return false;
  }

  const photo = await storage.getPhoto(annotation.photoId);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return false;
  }

  const project = await storage.getProject(photo.projectId);
  if (!project || !project.companyId) {
    res.status(404).json({ error: "Project not found" });
    return false;
  }

  return verifyCompanyAccess(req, res, project.companyId);
}

// Helper to verify company access for tags
async function verifyTagCompanyAccess(req: any, res: any, tagId: string): Promise<boolean> {
  const tag = await storage.getTag(tagId);
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return false;
  }

  // Global predefined tags can't be modified
  if (!tag.projectId) {
    res.status(403).json({ error: "Cannot modify global predefined tags" });
    return false;
  }

  const project = await storage.getProject(tag.projectId);
  if (!project || !project.companyId) {
    res.status(404).json({ error: "Project not found" });
    return false;
  }

  return verifyCompanyAccess(req, res, project.companyId);
}

// Helper to verify company access for tasks
async function verifyTaskCompanyAccess(req: any, res: any, taskId: string): Promise<boolean> {
  const task = await storage.getTask(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return false;
  }

  const project = await storage.getProject(task.projectId);
  if (!project || !project.companyId) {
    res.status(404).json({ error: "Project not found" });
    return false;
  }

  return verifyCompanyAccess(req, res, project.companyId);
}

// Helper to verify company access for todos
async function verifyTodoCompanyAccess(req: any, res: any, todoId: string): Promise<boolean> {
  const todo = await storage.getTodo(todoId);
  if (!todo) {
    res.status(404).json({ error: "To-do not found" });
    return false;
  }

  // Verify user is creator, assignee, or in same company
  const user = await getUserWithCompany(req, res);
  if (!user) return false;
  
  // User must be creator or assignee
  if (todo.createdBy !== user.id && todo.assignedTo !== user.id) {
    // Or if todo has a project, verify company access through project
    if (todo.projectId) {
      const project = await storage.getProject(todo.projectId);
      if (!project || !project.companyId) {
        res.status(404).json({ error: "Project not found" });
        return false;
      }
      return verifyCompanyAccess(req, res, project.companyId);
    } else {
      // General todo - must be creator or assignee
      res.status(403).json({ error: "Access denied" });
      return false;
    }
  }

  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public directory (PWA assets: manifest, icons, sw)
  // This MUST be first to prevent Vite catch-all from intercepting these files
  const publicPath = path.join(process.cwd(), 'public');
  app.use(express.static(publicPath));
  
  // Serve PWA files (fallback if static doesn't work)
  app.get('/sw.js', async (req, res) => {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(swPath);
  });
  
  app.get('/manifest.json', async (req, res) => {
    try {
      const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.send(manifestContent);
    } catch (error) {
      console.error('[Routes] Error serving manifest:', error);
      res.status(500).json({ error: 'Failed to load manifest' });
    }
  });
  
  app.get('/icon-:size.png', async (req, res) => {
    try {
      const iconPath = path.join(process.cwd(), 'public', `icon-${req.params.size}.png`);
      const iconBuffer = await fs.readFile(iconPath);
      res.setHeader('Content-Type', 'image/png');
      res.send(iconBuffer);
    } catch (error) {
      console.error(`[Routes] Error serving icon-${req.params.size}:`, error);
      res.status(500).json({ error: 'Failed to load icon' });
    }
  });

  // Apple App Site Association (AASA) file for Universal Links
  // Required for iOS to recognize this domain as associated with the app
  // NOTE: Update APPLE_TEAM_ID environment variable with your Apple Developer Team ID
  const aasaContent = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [
            `${process.env.APPLE_TEAM_ID || 'XXXXXXXXXX'}.com.fieldsnaps.app`
          ],
          paths: [
            '/auth/callback',
            '/auth/callback/*',
            '/api/callback',
            '/invite/*'
          ],
          components: [
            {
              '/': '/auth/callback',
              comment: 'Supabase OAuth callback'
            },
            {
              '/': '/auth/callback/*',
              comment: 'Supabase OAuth callback with params'
            }
          ]
        }
      ]
    },
    webcredentials: {
      apps: [
        `${process.env.APPLE_TEAM_ID || 'XXXXXXXXXX'}.com.fieldsnaps.app`
      ]
    }
  };

  app.get('/.well-known/apple-app-site-association', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(aasaContent);
  });

  app.get('/apple-app-site-association', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(aasaContent);
  });

  // Setup authentication with rate limiting
  await setupAuth(app, authRateLimiter);
  
  // Setup WebAuthn biometric authentication
  setupWebAuthn(app);

  // Apply CORS middleware to all API routes only (not static assets)
  // This allows custom domains like fieldsnaps.com to work without CORS errors
  app.use('/api/*', corsConfig);

  // ========================================
  // Company Routes
  // ========================================

  // Create company during onboarding
  app.post("/api/companies", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Company name is required" });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.companyId) {
        return res.status(400).json({ error: "User already belongs to a company" });
      }

      // Create company with user as owner
      const company = await storage.createCompany({
        name: name.trim(),
        ownerId: userId,
      });

      // Update user to join company as owner
      await storage.updateUser(userId, {
        companyId: company.id,
        role: 'owner',
      });

      res.json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user's company
  app.get("/api/companies/me", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.companyId) {
        return res.status(404).json({ error: "User does not belong to a company" });
      }

      const company = await storage.getCompany(user.companyId);
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate invite link (owner only)
  app.post("/api/companies/invite-link", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(404).json({ error: "User does not belong to a company" });
      }

      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Only billing owner can generate invite links
      if (company.ownerId !== userId) {
        return res.status(403).json({ error: "Only the company owner can generate invite links" });
      }

      // Generate new invite link
      const inviteLink = await storage.generateInviteLink(user.companyId);
      
      res.json(inviteLink);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Revoke invite link (owner only)
  app.delete("/api/companies/invite-link", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(404).json({ error: "User does not belong to a company" });
      }

      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Only billing owner can revoke invite links
      if (company.ownerId !== userId) {
        return res.status(403).json({ error: "Only the company owner can revoke invite links" });
      }

      await storage.revokeInviteLink(user.companyId);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate invite token (public endpoint for pre-signup validation)
  app.get("/api/companies/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const company = await storage.getCompanyByInviteToken(token);

      if (!company) {
        return res.status(404).json({ error: "Invalid invite link" });
      }

      // Check if token is expired
      if (company.inviteLinkExpiresAt && new Date() > company.inviteLinkExpiresAt) {
        return res.status(410).json({ error: "Invite link has expired" });
      }

      // Check if max uses reached
      if (company.inviteLinkUses >= company.inviteLinkMaxUses) {
        return res.status(410).json({ error: "Invite link has reached maximum uses" });
      }

      // Return company info for UI display
      res.json({
        companyName: company.name,
        valid: true,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Accept invite and join company (authenticated users)
  app.post("/api/companies/invite/:token/accept", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const { token } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.companyId) {
        return res.status(400).json({ error: "User already belongs to a company" });
      }

      const company = await storage.getCompanyByInviteToken(token);

      if (!company) {
        return res.status(404).json({ error: "Invalid invite link" });
      }

      // Check if token is expired
      if (company.inviteLinkExpiresAt && new Date() > company.inviteLinkExpiresAt) {
        return res.status(410).json({ error: "Invite link has expired" });
      }

      // Check if max uses reached
      if (company.inviteLinkUses >= company.inviteLinkMaxUses) {
        return res.status(410).json({ error: "Invite link has reached maximum uses" });
      }

      // Add user to company
      await storage.updateUser(userId, {
        companyId: company.id,
        role: 'member',
        invitedBy: company.ownerId,
      });

      // Increment invite uses
      await storage.updateCompany(company.id, {
        inviteLinkUses: company.inviteLinkUses + 1,
      });

      // Update Stripe subscription quantity (if subscription exists)
      const subscription = await storage.getSubscriptionByCompanyId(company.id);
      if (subscription?.stripeSubscriptionId) {
        try {
          const members = await storage.getCompanyMembers(company.id);
          await billingService.updateSubscriptionQuantity(
            subscription.stripeSubscriptionId,
            members.length
          );
        } catch (error) {
          console.error('Failed to update Stripe subscription quantity:', error);
          // Don't fail the invite acceptance if Stripe update fails
        }
      }

      res.json({ success: true, company });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Team Management Routes
  app.get("/api/companies/members", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      const members = await storage.getCompanyMembers(user.companyId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/companies/members/:userId", isAuthenticatedAndWhitelisted, validateUuidParam('userId'), async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      const targetUserId = req.params.userId;

      if (!currentUser || !currentUser.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Only the billing owner can remove members
      const company = await storage.getCompany(currentUser.companyId);
      if (!company || company.ownerId !== currentUserId) {
        return res.status(403).json({ error: "Only the billing owner can remove members" });
      }

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.companyId !== currentUser.companyId) {
        return res.status(404).json({ error: "User not found in your company" });
      }

      // Can't remove yourself
      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "Cannot remove yourself. Transfer ownership first." });
      }

      // Remove user from company
      await storage.removeUserFromCompany(targetUserId);

      // Update Stripe subscription quantity (if subscription exists)
      const subscription = await storage.getSubscriptionByCompanyId(currentUser.companyId);
      if (subscription?.stripeSubscriptionId) {
        try {
          const members = await storage.getCompanyMembers(currentUser.companyId);
          await billingService.updateSubscriptionQuantity(
            subscription.stripeSubscriptionId,
            members.length
          );
        } catch (error) {
          console.error('Failed to update Stripe subscription quantity:', error);
          // Don't fail the member removal if Stripe update fails
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/companies/members/:userId/promote", isAuthenticatedAndWhitelisted, validateUuidParam('userId'), async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      const targetUserId = req.params.userId;

      if (!currentUser || !currentUser.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Only the current owner can promote someone else
      const company = await storage.getCompany(currentUser.companyId);
      if (!company || company.ownerId !== currentUserId) {
        return res.status(403).json({ error: "Only the billing owner can transfer ownership" });
      }

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.companyId !== currentUser.companyId) {
        return res.status(404).json({ error: "User not found in your company" });
      }

      // Can't promote yourself
      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "You are already the owner" });
      }

      // Transfer ownership
      await storage.updateCompany(company.id, { ownerId: targetUserId });
      await storage.updateUser(targetUserId, { role: 'owner' });
      await storage.updateUser(currentUserId, { role: 'member' });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PDF Settings Routes
  const pdfSettingsSchema = z.object({
    pdfCompanyName: z.string().max(255).optional(),
    pdfCompanyAddress: z.string().optional(),
    pdfCompanyPhone: z.string().max(50).optional(),
    pdfHeaderText: z.string().optional(),
    pdfFooterText: z.string().optional(),
    pdfFontFamily: z.enum(['Arial', 'Helvetica', 'Times']).optional(),
    pdfFontSizeTitle: z.number().int().min(12).max(48).optional(),
    pdfFontSizeHeader: z.number().int().min(10).max(32).optional(),
    pdfFontSizeBody: z.number().int().min(8).max(24).optional(),
    pdfFontSizeCaption: z.number().int().min(6).max(16).optional(),
    pdfDefaultGridLayout: z.number().int().min(1).max(4).optional(),
    pdfIncludeTimestamp: z.boolean().optional(),
    pdfIncludeTags: z.boolean().optional(),
    pdfIncludeAnnotations: z.boolean().optional(),
    pdfIncludeSignatureLine: z.boolean().optional(),
  });

  app.put("/api/companies/pdf-settings", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Only the owner can update PDF settings
      const company = await storage.getCompany(user.companyId);
      if (!company || company.ownerId !== userId) {
        return res.status(403).json({ error: "Only the billing owner can update PDF settings" });
      }

      // Validate PDF settings with Zod
      const validated = pdfSettingsSchema.parse(req.body);

      await storage.updateCompany(company.id, validated);
      const updatedCompany = await storage.getCompany(company.id);

      res.json(updatedCompany);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Time Tracking Settings Routes
  const timeTrackingSettingsSchema = z.object({
    autoTrackingEnabledByDefault: z.boolean(),
  });

  app.put("/api/companies/time-tracking-settings", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Only the owner can update time tracking settings
      const company = await storage.getCompany(user.companyId);
      if (!company || company.ownerId !== userId) {
        return res.status(403).json({ error: "Only the billing owner can update time tracking settings" });
      }

      // Validate time tracking settings with Zod
      const validated = timeTrackingSettingsSchema.parse(req.body);

      await storage.updateCompany(company.id, validated);
      const updatedCompany = await storage.getCompany(company.id);

      res.json(updatedCompany);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/companies/pdf-logo", isAuthenticatedAndWhitelisted, uploadRateLimiter, upload.single('logo'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Only the owner can upload logo
      const company = await storage.getCompany(user.companyId);
      if (!company || company.ownerId !== userId) {
        return res.status(403).json({ error: "Only the billing owner can upload logo" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No logo file provided" });
      }

      // Validate it's an image
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "Logo must be an image file" });
      }

      const objectStorageService = new ObjectStorageService();

      // Get presigned upload URL
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Upload to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: req.file.buffer,
        headers: {
          'Content-Type': req.file.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Object storage upload failed: ${uploadResponse.status}`);
      }

      // Set ACL policy - logo should be public so it can be included in PDFs
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: userId,
          visibility: "public",
        }
      );

      // Update company with logo URL
      await storage.updateCompany(company.id, { pdfLogoUrl: objectPath });

      res.json({ logoUrl: objectPath });
    } catch (error: any) {
      console.error('Logo upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Object Storage routes - Referenced from blueprint:javascript_object_storage
  // Endpoint for serving private objects (photos) with ACL checks
  app.get("/objects/:objectPath(*)", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Endpoint for getting presigned upload URL
  app.post("/api/objects/upload", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Direct-to-cloud upload: Get presigned URL for photo upload
  // Client uploads directly to object storage, then calls complete endpoint
  const presignedUploadSessions = new Map<string, {
    userId: string;
    projectId: string;
    objectPath: string;
    metadata: {
      caption?: string;
      mediaType: 'photo' | 'video';
      width?: number;
      height?: number;
      mimeType: string;
      thumbnailObjectPath?: string;
      unitLabel?: string;
    };
    createdAt: Date;
  }>();

  app.post("/api/photos/presigned-upload", isAuthenticatedAndWhitelisted, uploadRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { projectId, caption, mediaType, width, height, mimeType, unitLabel } = req.body;

      if (!projectId || !mediaType || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: projectId, mediaType, mimeType" });
      }

      // Get user with company
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Verify project access
      if (!await verifyProjectCompanyAccess(req, res, projectId)) return;

      // Generate presigned upload URL
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = uploadURL.split('?')[0];

      // Create session to track this upload
      const sessionId = crypto.randomUUID();
      presignedUploadSessions.set(sessionId, {
        userId,
        projectId,
        objectPath,
        metadata: {
          caption,
          mediaType: mediaType || 'photo',
          width: width ? parseInt(width) : undefined,
          height: height ? parseInt(height) : undefined,
          mimeType,
          unitLabel,
        },
        createdAt: new Date(),
      });

      // Auto-cleanup old sessions (>1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      for (const [id, session] of Array.from(presignedUploadSessions.entries())) {
        if (session.createdAt < oneHourAgo) {
          presignedUploadSessions.delete(id);
        }
      }

      res.json({ 
        uploadURL, 
        objectPath,
        sessionId,
        message: 'Upload file to uploadURL, then call POST /api/photos/complete-presigned/:sessionId'
      });
    } catch (error: any) {
      console.error("[PresignedUpload] Error generating presigned URL:", error);
      handleError(res, error);
    }
  });

  // Direct-to-cloud upload: Complete presigned upload and create photo record
  app.post("/api/photos/complete-presigned/:sessionId", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    const uploadStartTime = Date.now();
    let fileSize = req.body.fileSize || 0; // Frontend should send file size for metrics
    
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;

      // Get session data
      const session = presignedUploadSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found or expired" });
      }

      // Verify user owns this session
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get user with company for photographer info
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const objectStorageService = new ObjectStorageService();

      // Set ACL policy for uploaded object
      const finalObjectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        session.objectPath,
        {
          owner: userId,
          visibility: "private",
        }
      );

      // Create photo record
      const photographerId = user.companyId || userId;
      
      // Get photographer name from company or user
      let photographerName = '';
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        photographerName = company?.name || '';
      }
      if (!photographerName) {
        photographerName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      }

      const validated = insertPhotoSchema.parse({
        projectId: session.projectId,
        url: finalObjectPath,
        mediaType: session.metadata.mediaType,
        caption: session.metadata.caption || `Upload_${Date.now()}`,
        width: session.metadata.width,
        height: session.metadata.height,
        photographerId,
        photographerName,
        unitLabel: session.metadata.unitLabel,
      });

      const photo = await storage.createPhoto(validated);

      // Auto-set as cover photo if needed
      const project = await storage.getProject(session.projectId);
      if (project && !project.coverPhotoId) {
        await storage.updateProject(session.projectId, { coverPhotoId: photo.id });
      }

      // Update project activity
      await storage.updateProject(session.projectId, { lastActivityAt: new Date() });

      // Log activity for accountability
      if (user.companyId) {
        // Extract basic device info from User-Agent for accountability
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const deviceInfo = userAgent.includes('Mobile') 
          ? (userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS Device' : 'Mobile Device')
          : (userAgent.includes('Mac') ? 'Mac' : 'Desktop');

        await storage.createActivityLog({
          userId,
          companyId: user.companyId,
          action: 'photo_uploaded',
          entityType: 'photo',
          entityId: photo.id,
          metadata: {
            projectId: session.projectId,
            projectName: project?.name || 'Unknown Project',
            photoCaption: photo.caption,
            mediaType: photo.mediaType,
            unitLabel: photo.unitLabel || undefined,
            deviceInfo,
          },
        });
      }

      // Invalidate cache
      invalidateCachePattern(userId, '/api/projects');

      // Clean up session
      presignedUploadSessions.delete(sessionId);

      // Track successful presigned upload
      const uploadDuration = Date.now() - uploadStartTime;
      uploadMetrics.log({
        userId,
        projectId: session.projectId,
        method: 'presigned',
        status: 'success',
        fileSize,
        duration: uploadDuration,
      });

      res.status(201).json(photo);
    } catch (error: any) {
      console.error("[PresignedUpload] Complete error:", error);
      
      // Track failed presigned upload
      if (req.user?.claims?.sub && fileSize > 0) {
        const session = presignedUploadSessions.get(req.params.sessionId);
        uploadMetrics.log({
          userId: req.user.claims.sub,
          projectId: session?.projectId || '',
          method: 'presigned',
          status: 'failed',
          fileSize,
          error: error.message || 'Unknown error',
        });
      }
      
      handleError(res, error);
    }
  });

  // Endpoint for setting ACL policy after photo upload and updating photo URL
  app.put("/api/photos/:photoId/object-url", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req: any, res) => {
    try {
      if (!req.body.photoURL) {
        return res.status(400).json({ error: "photoURL is required" });
      }

      const userId = req.user?.claims?.sub;
      
      // Security: Verify photo ownership before allowing URL updates
      const existingPhoto = await storage.getPhoto(req.params.photoId);
      if (!existingPhoto) {
        return res.status(404).json({ error: "Photo not found" });
      }
      if (existingPhoto.photographerId !== userId) {
        return res.status(403).json({ error: "You don't have permission to update this photo" });
      }
      
      const objectStorageService = new ObjectStorageService();
      
      // Set ACL policy: owner is the uploader, visibility is private by default
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.photoURL,
        {
          owner: userId,
          visibility: "private", // Photos are private by default, share flow can make them public
        },
      );

      // Update photo URL in database
      await storage.updatePhoto(req.params.photoId, { url: objectPath });

      res.json({ objectPath });
    } catch (error: any) {
      console.error("Error setting photo object URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticatedAndWhitelisted, async (req: any, res) => {
    // User is authenticated (via JWT or session) - return user data
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      return res.json(user);
    } catch (error) {
      console.error("Error fetching authenticated user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile photo upload
  app.post('/api/user/profile-photo', isAuthenticatedAndWhitelisted, uploadRateLimiter, upload.single('photo'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.file) {
        return res.status(400).json({ error: "No photo file provided" });
      }

      // Validate it's an image
      const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!imageTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
      }

      const objectStorageService = new ObjectStorageService();

      // Get presigned upload URL
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Upload to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: req.file.buffer,
        headers: {
          'Content-Type': req.file.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Object storage upload failed: ${uploadResponse.status}`);
      }

      // Set ACL policy - profile photos should be public so they can be displayed
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: userId,
          visibility: "public",
        }
      );

      // Update user profile with new photo URL
      await storage.updateUser(userId, { profileImageUrl: objectPath });

      // Invalidate user cache
      invalidateCachePattern(userId, '/api/auth/user');

      return res.json({ profileImageUrl: objectPath });
    } catch (error: any) {
      console.error("Error uploading profile photo:", error);
      return res.status(500).json({ error: error.message || "Failed to upload profile photo" });
    }
  });

  // Update user profile (name and other fields)
  app.patch('/api/user/profile', isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const updateSchema = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
      });

      const data = updateSchema.parse(req.body);

      const updatedUser = await storage.updateUser(userId, data);

      // Invalidate user cache
      invalidateCachePattern(userId, '/api/auth/user');

      return res.json(updatedUser);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating user profile:", error);
      return res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // User Settings routes
  app.get('/api/settings', isAuthenticatedAndWhitelisted, cacheMiddleware(300), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      return res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      return res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put('/api/settings', isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.updateUserSettings(userId, req.body);
      
      // Invalidate settings cache after update
      invalidateCachePattern(userId, '/api/settings');
      
      return res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      return res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Projects - protected routes
  app.get("/api/projects", isAuthenticatedAndWhitelisted, fieldFilterMiddleware, cacheMiddleware(30), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.json([]); // Return empty if no company
      }

      const projects = await storage.getProjectsByCompany(user.companyId);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk endpoint to get all projects with photo counts in one query (eliminates N+1)
  app.get("/api/projects/with-counts", isAuthenticatedAndWhitelisted, fieldFilterMiddleware, cacheMiddleware(30), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.json([]); // Return empty if no company
      }

      const projectsWithCounts = await storage.getProjectsByCompanyWithPhotoCounts(user.companyId);
      res.json(projectsWithCounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), fieldFilterMiddleware, cacheMiddleware(60), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      const project = await storage.getProject(req.params.id);
      if (!project) {
        throw errors.notFound('Project');
      }
      
      // Verify project belongs to user's company
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Update project's last activity timestamp when viewed
      await storage.updateProject(req.params.id, { lastActivityAt: new Date() });
      
      res.json(project);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get project members for assignment dropdown in to-do creation
  app.get("/api/projects/:id/members", isAuthenticatedAndWhitelisted, validateUuidParam('id'), cacheMiddleware(120), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Verify project belongs to user's company
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get all active members of the company (excluding removed users)
      const members = await storage.getCompanyMembers(user.companyId);
      
      // Return simplified member info for dropdown
      const memberList = members.map(member => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        profileImageUrl: member.profileImageUrl,
      }));
      
      res.json(memberList);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/projects", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      
      // Geocode address if provided to get GPS coordinates
      if (validated.address) {
        const geocodeResult = await geocodeAddress(validated.address);
        if (geocodeResult) {
          validated.latitude = geocodeResult.latitude;
          validated.longitude = geocodeResult.longitude;
          // Optionally update address to the formatted version from Google
          // validated.address = geocodeResult.formattedAddress;
        }
      }
      
      // Check if this is the user's first project and start trial if needed
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(400).json({ error: "User must belong to a company to create projects" });
      }
      
      // Start trial if user has no trial start date yet (first project)
      if (user && !user.trialStartDate && user.subscriptionStatus === 'trial') {
        console.log(`[Trial] Starting 7-day trial for user ${userId} on first project creation`);
        await storage.startUserTrial(userId);
      }
      
      // Assign companyId and createdBy
      const projectData = {
        ...validated,
        companyId: user.companyId,
        createdBy: userId,
      };
      
      const project = await storage.createProject(projectData);

      // Create geofence if project has location data
      if (project.latitude && project.longitude) {
        console.log(`[Geofence] Creating geofence for new project ${project.id} (${project.name})`);
        await storage.createGeofence({
          name: `${project.name} Geofence`,
          projectId: project.id,
          companyId: project.companyId,
          latitude: project.latitude,
          longitude: project.longitude,
          radius: 150, // 500ft default (150 meters ≈ 492 feet)
          isActive: true,
        });
      }

      // Log activity for accountability
      if (user.companyId) {
        await storage.createActivityLog({
          userId,
          companyId: user.companyId,
          action: 'project_created',
          entityType: 'project',
          entityId: project.id,
          metadata: {
            projectName: project.name,
            address: project.address || undefined,
          },
        });
      }
      
      // Invalidate projects cache after creation
      invalidateCachePattern(userId, '/api/projects');
      
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate with partial schema (all fields optional)
      const validated = insertProjectSchema.partial().parse(req.body);
      
      // Track if location changed for geofence updates
      let locationChanged = false;
      
      // Geocode address if provided to get GPS coordinates
      if (validated.address) {
        const geocodeResult = await geocodeAddress(validated.address);
        if (geocodeResult) {
          validated.latitude = geocodeResult.latitude;
          validated.longitude = geocodeResult.longitude;
          
          // Check if location actually changed (normalize to numbers for comparison)
          const oldLat = project.latitude ? parseFloat(project.latitude) : null;
          const oldLng = project.longitude ? parseFloat(project.longitude) : null;
          const newLat = parseFloat(geocodeResult.latitude);
          const newLng = parseFloat(geocodeResult.longitude);
          
          if (oldLat !== newLat || oldLng !== newLng) {
            locationChanged = true;
          }
        }
      }
      
      const updated = await storage.updateProject(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // If location changed, update associated geofences
      if (locationChanged && updated.latitude && updated.longitude) {
        const projectGeofences = await storage.getGeofencesByProject(req.params.id);
        
        for (const geofence of projectGeofences) {
          await storage.updateGeofence(geofence.id, {
            latitude: updated.latitude,
            longitude: updated.longitude,
          });
        }
      }
      
      // Invalidate projects cache after update
      invalidateCachePattern(userId, '/api/projects');
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id/toggle-complete", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updated = await storage.toggleProjectCompletion(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Invalidate projects cache after toggle
      invalidateCachePattern(userId, '/api/projects');
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Track project visit - Phase 3 (Locations feature)
  app.post("/api/projects/:id/visit", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const visit = await storage.trackProjectVisit(userId, req.params.id);
      
      // Invalidate projects cache after visit tracking
      invalidateCachePattern(userId, '/api/projects');
      
      res.json(visit);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's favorite project IDs - Phase 3.4
  app.get("/api/user/favorite-projects", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favoriteIds = await storage.getUserFavoriteProjectIds(userId);
      res.json(favoriteIds);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's recent project IDs - Phase 3.4
  app.get("/api/user/recent-projects", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recentIds = await storage.getUserRecentProjectIds(userId, 10);
      res.json(recentIds);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle project favorite - Phase 3 (Locations feature)
  app.post("/api/projects/:id/favorite", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Toggle favorite status (user-scoped)
      const { isFavorite } = req.body;
      if (typeof isFavorite !== 'boolean') {
        return res.status(400).json({ error: "isFavorite must be a boolean" });
      }

      const result = await storage.toggleProjectFavorite(userId, req.params.id, isFavorite);
      
      // Invalidate projects cache after favorite toggle
      invalidateCachePattern(userId, '/api/projects');
      
      res.json({ success: true, isFavorite, favorite: result !== false ? result : null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Invalidate projects cache after deletion
      invalidateCachePattern(userId, '/api/projects');
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Project sharing - generate or get share token
  app.post("/api/projects/:id/share", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Verify project belongs to user's company
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get company info for branding
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(500).json({ error: "Company not found" });
      }

      // Parse request body
      const { selectedPhotoIds, expirationDays } = req.body;

      // Validate selectedPhotoIds belong to this project (security check)
      if (selectedPhotoIds && Array.isArray(selectedPhotoIds) && selectedPhotoIds.length > 0) {
        const { photos: projectPhotos } = await storage.getProjectPhotos(req.params.id);
        const projectPhotoIds = new Set(projectPhotos.map(p => p.id));
        
        const invalidPhotoIds = selectedPhotoIds.filter(id => !projectPhotoIds.has(id));
        if (invalidPhotoIds.length > 0) {
          return res.status(400).json({ 
            error: "Some photo IDs do not belong to this project" 
          });
        }
      }

      // Calculate expiration date if provided
      let expiresAt: Date | null = null;
      if (expirationDays && typeof expirationDays === 'number' && expirationDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
      }

      // Delete existing share if any (since we're updating photo selection)
      const existingShare = await storage.getShareByProjectId(req.params.id);
      if (existingShare) {
        await storage.deleteShare(existingShare.id);
      }

      // Generate random 32-character token
      const token = Array.from(
        { length: 32 },
        () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
      ).join('');

      const share = await storage.createShare({
        token,
        projectId: req.params.id,
        photoIds: Array.isArray(selectedPhotoIds) && selectedPhotoIds.length > 0 ? selectedPhotoIds : null,
        companyName: company.name,
        expiresAt,
      });

      // Log activity for accountability
      if (user.companyId) {
        await storage.createActivityLog({
          userId,
          companyId: user.companyId,
          action: 'share_created',
          entityType: 'share',
          entityId: share.id,
          metadata: {
            projectId: req.params.id,
            projectName: project.name,
            photoCount: selectedPhotoIds?.length || 0,
            expiresAt: expiresAt?.toISOString() || undefined,
          },
        });
      }

      res.json({ token: share.token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PDF Routes
  app.get("/api/projects/:projectId/pdfs", isAuthenticatedAndWhitelisted, validateUuidParam('projectId'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const pdfsForProject = await storage.getProjectPdfs(req.params.projectId);
      res.json(pdfsForProject);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/pdfs", isAuthenticatedAndWhitelisted, uploadRateLimiter, validateUuidParam('projectId'), upload.single('pdf'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      // Verify project belongs to user's company
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      // Upload PDF to Object Storage
      const filename = req.file.originalname || `pdf_${Date.now()}.pdf`;
      const objectKey = `pdfs/${project.id}/${Date.now()}_${filename}`;
      
      const objectStorageService = new ObjectStorageService();
      let storageUrl: string;
      try {
        storageUrl = await objectStorageService.uploadFile(
          objectKey,
          req.file.buffer,
          req.file.mimetype || 'application/pdf'
        );
      } catch (uploadError: any) {
        console.error('Object storage upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload PDF to storage' });
      }

      // Create database record
      const validated = insertPdfSchema.parse({
        projectId: req.params.projectId,
        filename,
        storageUrl,
        photoCount: parseInt(req.body.photoCount) || 0,
        gridLayout: parseInt(req.body.gridLayout) || 2,
        settings: req.body.settings ? JSON.parse(req.body.settings) : null,
        createdBy: userId,
      });

      const pdf = await storage.createPdf(validated);

      res.status(201).json(pdf);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.delete("/api/pdfs/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(403).json({ error: "User must belong to a company" });
      }

      const pdf = await storage.getPdf(req.params.id);
      if (!pdf) {
        return res.status(404).json({ error: "PDF not found" });
      }

      // Verify PDF's project belongs to user's company
      const project = await storage.getProject(pdf.projectId);
      if (!project || project.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete from object storage
      try {
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.deleteObjectEntity(pdf.storageUrl);
      } catch (error) {
        console.error('Failed to delete PDF from object storage:', error);
        // Continue with database deletion even if object storage deletion fails
      }

      const deleted = await storage.deletePdf(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "PDF not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint to view shared project (no authentication required)
  app.get("/api/shared/:token", async (req, res) => {
    try {
      const share = await storage.getShareByToken(req.params.token);
      if (!share) {
        return res.status(404).json({ error: "Share not found or expired" });
      }

      // Check if expired
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Share has expired" });
      }

      // Get project and active photos (excluding trash)
      const project = await storage.getProject(share.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const { photos: allPhotos } = await storage.getProjectPhotos(share.projectId);

      // Filter photos if specific photoIds were selected
      let photos = allPhotos;
      if (share.photoIds && Array.isArray(share.photoIds) && share.photoIds.length > 0) {
        photos = allPhotos.filter(photo => share.photoIds!.includes(photo.id));
      }

      res.json({
        companyName: share.companyName || null,
        project: {
          name: project.name,
          description: project.description,
          address: project.address,
        },
        photos: photos.map(photo => ({
          id: photo.id,
          url: photo.url,
          caption: photo.caption,
          createdAt: photo.createdAt,
          // Note: photographerName removed for privacy
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Log view of shared link (for analytics)
  app.post("/api/shared/:token/view-log", async (req, res) => {
    try {
      const share = await storage.getShareByToken(req.params.token);
      if (!share) {
        return res.status(404).json({ error: "Share not found" });
      }

      // Get client IP (handle proxy/forwarding)
      const viewerIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                       req.socket.remoteAddress || 
                       null;

      const userAgent = req.headers['user-agent'] || null;

      await storage.createShareViewLog({
        shareId: share.id,
        viewerIp,
        userAgent,
      });

      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Photos
  app.get("/api/photos", isAuthenticatedAndWhitelisted, cacheMiddleware(30), async (req, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user?.companyId) {
        console.error('[GET /api/photos] User not associated with a company:', req.user.claims.sub);
        return res.status(403).json({ error: "User not associated with a company" });
      }
      
      const companyId = user.companyId;
      
      // Parse pagination params
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 100) : 50;
      const cursor = req.query.cursor as string | undefined;
      
      console.log('[GET /api/photos] Fetching photos for company:', companyId, 'limit:', limit, 'cursor:', cursor);
      const result = await storage.getAllPhotos(companyId, { limit, cursor });
      console.log('[GET /api/photos] Success - returned', result.photos.length, 'photos, total:', result.total);
      res.json(result);
    } catch (error: any) {
      console.error('[GET /api/photos] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:projectId/photos", isAuthenticatedAndWhitelisted, validateUuidParam('projectId'), fieldFilterMiddleware, cacheMiddleware(30), async (req, res) => {
    try {
      if (!await verifyProjectCompanyAccess(req, res, req.params.projectId)) return;
      
      // Parse pagination params
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const cursor = req.query.cursor as string | undefined;
      
      const result = await storage.getProjectPhotos(req.params.projectId, { limit, cursor });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/photos/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.id);
      if (!authorized) return;
      
      const photo = await storage.getPhoto(req.params.id);
      if (!photo) {
        throw errors.notFound('Photo');
      }
      res.json(photo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Serve photo image with CORS headers for iOS WebView
  app.get("/api/photos/:id/image", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      // Verify access and get photo in one query (optimization)
      const { authorized, photo } = await verifyPhotoCompanyAccess(req, res, req.params.id);
      if (!authorized) return;

      if (!photo || !photo.url) {
        return res.status(404).json({ error: "Photo has no image" });
      }

      // Set CORS headers for iOS WebView
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(photo.url);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error serving photo image:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Serve photo thumbnail with CORS headers for iOS WebView
  app.get("/api/photos/:id/thumbnail", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      // Verify access and get photo in one query (optimization)
      const { authorized, photo } = await verifyPhotoCompanyAccess(req, res, req.params.id);
      if (!authorized) return;

      // If no thumbnail, serve the full image
      const imageUrl = photo?.thumbnailUrl || photo?.url;
      if (!imageUrl) {
        return res.status(404).json({ error: "Photo has no image" });
      }

      // Set CORS headers for iOS WebView
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(imageUrl);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error serving photo thumbnail:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Thumbnail not found" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Unauthenticated photo proxy for public share links
  app.get("/api/shared/:shareToken/photos/:id/image", validateUuidParam('id'), async (req, res) => {
    try {
      // Validate share token
      const share = await storage.getShareByToken(req.params.shareToken);
      if (!share) {
        return res.status(404).json({ error: "Share not found or expired" });
      }

      // Check if expired
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        return res.status(410).json({ error: "Share has expired" });
      }

      // Get photo and verify it belongs to the shared project
      const photo = await storage.getPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }

      if (photo.projectId !== share.projectId) {
        return res.status(403).json({ error: "Photo does not belong to this share" });
      }

      if (!photo.url) {
        return res.status(404).json({ error: "Photo has no image" });
      }

      // Set CORS headers for iOS WebView
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(photo.url);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error serving shared photo image:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/photos", isAuthenticatedAndWhitelisted, uploadRateLimiter, validateUuidParam('projectId'), upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]), async (req: any, res) => {
    const uploadStartTime = Date.now();
    let fileSize = 0;
    let userId = '';
    let projectId = req.params.projectId;
    
    try {
      if (!await verifyProjectCompanyAccess(req, res, req.params.projectId)) return;
      
      if (!req.files?.photo || !req.files.photo[0]) {
        throw errors.badRequest("No photo file provided");
      }

      const photoFile = req.files.photo[0];
      const thumbnailFile = req.files?.thumbnail?.[0];
      userId = req.user?.claims?.sub;
      fileSize = photoFile.size;
      
      // Ensure dev user exists in database (for dev bypass mode)
      if (userId === 'dev-user') {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          await storage.upsertUser({
            id: 'dev-user',
            email: 'dev@test.com',
            firstName: 'Dev',
            lastName: 'User',
            subscriptionStatus: 'active',
          });
        }
      }
      
      const objectStorageService = new ObjectStorageService();

      // Upload main photo to object storage
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: photoFile.buffer,
        headers: {
          'Content-Type': photoFile.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Object storage upload failed: ${uploadResponse.status}`);
      }

      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: userId,
          visibility: "private", // Photos are private by default, share flow can make them public
        }
      );

      // Upload thumbnail if provided
      let thumbnailPath: string | undefined;
      if (thumbnailFile) {
        const thumbnailUploadURL = await objectStorageService.getObjectEntityUploadURL();
        const thumbnailUploadResponse = await fetch(thumbnailUploadURL, {
          method: 'PUT',
          body: thumbnailFile.buffer,
          headers: {
            'Content-Type': thumbnailFile.mimetype,
          },
        });

        if (thumbnailUploadResponse.ok) {
          thumbnailPath = await objectStorageService.trySetObjectEntityAclPolicy(
            thumbnailUploadURL,
            {
              owner: userId,
              visibility: "private",
            }
          );
        }
      }

      // Get photographer info from auth or request body (for offline support)
      let photographerId = req.body.photographerId;
      let photographerName = req.body.photographerName;
      
      if (req.user) {
        photographerId = req.user.claims.sub;
        photographerName = req.user.claims.name || req.user.claims.email;
      }

      // Store photo metadata in database with object storage path
      const validated = insertPhotoSchema.parse({
        projectId: req.params.projectId,
        url: objectPath,
        thumbnailUrl: thumbnailPath,
        mediaType: req.body.mediaType || 'photo', // Default to 'photo' if not provided
        caption: req.body.caption || photoFile.originalname,
        width: req.body.width ? parseInt(req.body.width) : undefined,
        height: req.body.height ? parseInt(req.body.height) : undefined,
        photographerId,
        photographerName,
      });
      
      const photo = await storage.createPhoto(validated);
      
      // Auto-set as cover photo if project doesn't have one
      const project = await storage.getProject(req.params.projectId);
      if (project && !project.coverPhotoId) {
        await storage.updateProject(req.params.projectId, { coverPhotoId: photo.id });
      }
      
      // Update project's last activity timestamp
      await storage.updateProject(req.params.projectId, { lastActivityAt: new Date() });

      // Log activity for accountability
      if (req.user) {
        const user = await storage.getUser(userId);
        if (user?.companyId) {
          await storage.createActivityLog({
            userId,
            companyId: user.companyId,
            action: 'photo_uploaded',
            entityType: 'photo',
            entityId: photo.id,
            metadata: {
              projectId: req.params.projectId,
              projectName: project?.name || 'Unknown Project',
              photoCaption: photo.caption,
              mediaType: photo.mediaType,
            },
          });
        }
      }
      
      // Invalidate projects cache after photo upload (photo counts changed)
      invalidateCachePattern(userId, '/api/projects');
      
      // Track successful upload
      const uploadDuration = Date.now() - uploadStartTime;
      uploadMetrics.log({
        userId,
        projectId,
        method: 'multipart',
        status: 'success',
        fileSize,
        duration: uploadDuration,
      });
      
      res.status(201).json(photo);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      
      // Track failed upload
      if (userId && fileSize > 0) {
        uploadMetrics.log({
          userId,
          projectId,
          method: 'multipart',
          status: 'failed',
          fileSize,
          error: error.message || 'Unknown error',
        });
      }
      
      handleError(res, error);
    }
  });

  // ============================================================================
  // Chunked Upload Endpoints
  // ============================================================================
  
  // Initialize chunked upload session
  app.post("/api/uploads/chunked/init", isAuthenticatedAndWhitelisted, async (req, res) => {
    await initUploadSession(req, res);
  });
  
  // Upload individual chunk
  // CRITICAL: validateUploadSession MUST run before multer to prevent disk space DoS
  app.post("/api/uploads/chunked/chunk", isAuthenticatedAndWhitelisted, uploadRateLimiter, validateUploadSession, chunkUpload.single('chunk'), async (req, res) => {
    await uploadChunk(req, res);
  });
  
  // Get upload session status
  app.get("/api/uploads/chunked/:uploadId/status", isAuthenticatedAndWhitelisted, async (req, res) => {
    await getUploadStatus(req, res);
  });
  
  // Cancel upload session
  app.delete("/api/uploads/chunked/:uploadId", isAuthenticatedAndWhitelisted, async (req, res) => {
    await cancelUpload(req, res);
  });
  
  // Complete chunked upload and create photo (assembles chunks)
  app.post("/api/uploads/chunked/:uploadId/complete", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    const uploadStartTime = Date.now();
    let fileSize = 0;
    
    try {
      const { uploadId } = req.params;
      const { projectId, caption, mediaType, width, height } = req.body;
      const userId = req.user.claims.sub;
      
      // Get user with company
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      // Verify project access
      if (!await verifyProjectCompanyAccess(req, res, projectId)) return;
      
      // Assemble chunks into final file
      const fileBuffer = await assembleChunks(uploadId);
      fileSize = fileBuffer.length;
      
      // Upload to object storage
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Object storage upload failed: ${uploadResponse.status}`);
      }
      
      const objectPath = uploadURL.split('?')[0];
      
      // Create photo metadata in database
      const photographerId = user.companyId || userId;
      
      // Get photographer name from company or user
      let photographerName = '';
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        photographerName = company?.name || '';
      }
      if (!photographerName) {
        photographerName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      }
      
      const validated = insertPhotoSchema.parse({
        projectId,
        url: objectPath,
        mediaType: mediaType || 'photo',
        caption: caption || `Upload_${Date.now()}`,
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        photographerId,
        photographerName,
      });
      
      const photo = await storage.createPhoto(validated);
      
      // Auto-set as cover photo if needed
      const project = await storage.getProject(projectId);
      if (project && !project.coverPhotoId) {
        await storage.updateProject(projectId, { coverPhotoId: photo.id });
      }
      
      // Update project activity
      await storage.updateProject(projectId, { lastActivityAt: new Date() });

      // Log activity for accountability
      if (user.companyId) {
        await storage.createActivityLog({
          userId,
          companyId: user.companyId,
          action: 'photo_uploaded',
          entityType: 'photo',
          entityId: photo.id,
          metadata: {
            projectId,
            projectName: project?.name || 'Unknown Project',
            photoCaption: photo.caption,
            mediaType: photo.mediaType,
          },
        });
      }
      
      // Invalidate cache
      invalidateCachePattern(userId, '/api/projects');
      
      // Cleanup chunks
      await cleanupUploadSession(uploadId);
      
      // Track successful chunked upload
      const uploadDuration = Date.now() - uploadStartTime;
      uploadMetrics.log({
        userId,
        projectId,
        method: 'chunked',
        status: 'success',
        fileSize,
        duration: uploadDuration,
      });
      
      res.status(201).json(photo);
    } catch (error: any) {
      console.error('[ChunkedUpload] Complete error:', error);
      
      // Track failed chunked upload
      if (req.user?.claims?.sub && fileSize > 0) {
        uploadMetrics.log({
          userId: req.user.claims.sub,
          projectId: req.body.projectId,
          method: 'chunked',
          status: 'failed',
          fileSize,
          error: error.message || 'Unknown error',
        });
      }
      
      handleError(res, error);
    }
  });

  // Standalone photo upload (for to-dos and other non-project attachments)
  app.post("/api/photos/standalone", isAuthenticatedAndWhitelisted, uploadRateLimiter, upload.single('photo'), async (req: any, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      if (!req.file) {
        throw errors.badRequest("No photo file provided");
      }

      const userId = req.user?.claims?.sub;
      
      // Ensure dev user exists in database (for dev bypass mode)
      if (userId === 'dev-user') {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          await storage.upsertUser({
            id: 'dev-user',
            email: 'dev@test.com',
            firstName: 'Dev',
            lastName: 'User',
            subscriptionStatus: 'active',
          });
        }
      }
      
      const objectStorageService = new ObjectStorageService();

      // Get presigned upload URL for object storage
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Upload file directly to object storage using presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: req.file.buffer,
        headers: {
          'Content-Type': req.file.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Object storage upload failed: ${uploadResponse.status}`);
      }

      // Set ACL policy and get normalized object path
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: userId,
          visibility: "private", // Photos are private by default
        }
      );

      // Get photographer info from auth or request body (for offline support)
      let photographerId = req.body.photographerId;
      let photographerName = req.body.photographerName;
      
      if (req.user) {
        photographerId = req.user.claims.sub;
        photographerName = req.user.claims.name || req.user.claims.email;
      }

      // Store photo metadata in database with object storage path (no projectId)
      const validated = insertPhotoSchema.parse({
        projectId: null, // Standalone photo - not attached to a project
        url: objectPath,
        mediaType: req.body.mediaType || 'photo', // Default to 'photo' if not provided
        caption: req.body.caption || req.file.originalname,
        photographerId,
        photographerName,
      });
      
      const photo = await storage.createPhoto(validated);
      
      // Return id and url for attaching to to-dos
      res.status(201).json({ id: photo.id, url: photo.url });
    } catch (error: any) {
      console.error('Standalone photo upload error:', error);
      handleError(res, error);
    }
  });

  app.patch("/api/photos/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), upload.single('photo'), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // Security: Verify photo ownership before allowing updates
      const existingPhoto = await storage.getPhoto(req.params.id);
      if (!existingPhoto) {
        return res.status(404).json({ error: "Photo not found" });
      }
      if (existingPhoto.photographerId !== userId) {
        return res.status(403).json({ error: "You don't have permission to update this photo" });
      }
      
      let updateData: any = {};
      
      // Handle file upload if provided (annotated photo)
      if (req.file) {
        const objectStorageService = new ObjectStorageService();

        // Get presigned upload URL for object storage
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();

        // Upload file directly to object storage using presigned URL
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: req.file.buffer,
          headers: {
            'Content-Type': req.file.mimetype,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Object storage upload failed: ${uploadResponse.status}`);
        }

        // Set ACL policy and get normalized object path
        const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          uploadURL,
          {
            owner: userId,
            visibility: "private",
          }
        );

        updateData.url = objectPath;
      }
      
      // Handle caption
      if (req.body.caption !== undefined) {
        updateData.caption = req.body.caption;
      }
      
      // Handle projectId (for moving photos between projects)
      if (req.body.projectId !== undefined) {
        updateData.projectId = req.body.projectId;
      }
      
      // Note: annotations are stored in IndexedDB on the frontend, not in the database
      // The photoAnnotations table is used for server-side annotation storage if needed
      
      const validated = insertPhotoSchema.partial().parse(updateData);
      const updated = await storage.updatePhoto(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Photo update error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/photos/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req: any, res) => {
    try {
      // Security: Verify company access (any team member can delete their company's photos)
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.id);
      if (!authorized) return;
      
      const deleted = await storage.deletePhoto(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Photo Annotations
  app.get("/api/photos/:photoId/annotations", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const annotations = await storage.getPhotoAnnotations(req.params.photoId);
      res.json(annotations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/annotations", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const validated = insertPhotoAnnotationSchema.parse({
        ...req.body,
        photoId: req.params.photoId,
        userId: req.user.claims.sub, // Set annotation author
      });
      const annotation = await storage.createPhotoAnnotation(validated);
      res.status(201).json(annotation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/annotations/:id", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      if (!await verifyAnnotationCompanyAccess(req, res, req.params.id)) return;
      
      const deleted = await storage.deletePhotoAnnotation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Annotation not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Comments
  app.get("/api/photos/:photoId/comments", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const comments = await storage.getPhotoComments(req.params.photoId);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/comments", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const validated = insertCommentSchema.parse({
        ...req.body,
        photoId: req.params.photoId,
        userId: req.user.claims.sub, // Set comment author
      });
      const comment = await storage.createComment(validated);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Tasks
  app.post("/api/tasks", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify project access first
      if (!await verifyProjectCompanyAccess(req, res, req.body.projectId)) return;

      // Verify assignee is in same company
      const user = await storage.getUser(userId);
      const assignee = await storage.getUser(req.body.assignedTo);
      
      if (!assignee || assignee.companyId !== user.companyId) {
        return res.status(400).json({ error: "Can only assign tasks to members of your company" });
      }

      const validated = insertTaskSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const task = await storage.createTask(validated);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/projects/:projectId/tasks", isAuthenticatedAndWhitelisted, validateUuidParam('projectId'), async (req, res) => {
    try {
      if (!await verifyProjectCompanyAccess(req, res, req.params.projectId)) return;
      
      const tasks = await storage.getProjectTasks(req.params.projectId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tasks/my-tasks", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const tasks = await storage.getTasksAssignedToUser(userId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/tasks/:id", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      if (!await verifyTaskCompanyAccess(req, res, req.params.id)) return;
      
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks/:id/complete", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      if (!await verifyTaskCompanyAccess(req, res, req.params.id)) return;
      
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const task = await storage.completeTask(req.params.id, userId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks/:id/restore", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      if (!await verifyTaskCompanyAccess(req, res, req.params.id)) return;
      
      const task = await storage.restoreTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTaskCompanyAccess(req, res, req.params.id)) return;
      
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ToDos Routes
  app.get("/api/todos", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      const filters = {
        projectId: req.query.projectId as string | undefined,
        completed: req.query.completed === 'true' ? true : req.query.completed === 'false' ? false : undefined,
        view: (req.query.view as 'my-tasks' | 'team-tasks' | 'i-created') || 'my-tasks',
      };

      const todos = await storage.getTodos(user.companyId, user.id, filters);
      res.json(todos);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/api/todos/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTodoCompanyAccess(req, res, req.params.id)) return;
      
      const todo = await storage.getTodo(req.params.id);
      if (!todo) {
        return res.status(404).json({ error: "To-do not found" });
      }
      res.json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/todos", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Default assignedTo to creator if not provided
      const assignedTo = req.body.assignedTo || user.id;

      // Verify assignee is in same company (allow self-assignment)
      if (assignedTo !== user.id) {
        const assignee = await storage.getUser(assignedTo);
        if (!assignee) {
          return handleError(res, errors.validation("Assignee user not found"));
        }
        if (assignee.companyId !== user.companyId) {
          return handleError(res, errors.validation("Can only assign to-dos to members of your company"));
        }
      }

      // If project specified, verify access
      if (req.body.projectId) {
        if (!await verifyProjectCompanyAccess(req, res, req.body.projectId)) return;
      }

      const validated = insertTodoSchema.parse({
        ...req.body,
        assignedTo, // Use computed assignedTo (defaults to creator)
        createdBy: user.id,
      });
      
      const todo = await storage.createTodo(validated);

      // Log activity for accountability
      if (user.companyId) {
        const assignee = await storage.getUser(assignedTo);
        const assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email : 'Unknown';
        
        await storage.createActivityLog({
          userId: user.id,
          companyId: user.companyId,
          action: 'todo_created',
          entityType: 'todo',
          entityId: todo.id,
          metadata: {
            todoTitle: todo.title,
            assignedTo: assignedTo,
            assigneeName,
            projectId: todo.projectId || undefined,
          },
        });

        // Create notification if assigned to someone other than creator (Integration Task 3)
        if (assignedTo !== user.id) {
          const creatorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
          const projectInfo = todo.projectId ? await storage.getProject(todo.projectId) : null;
          
          await storage.createNotification({
            userId: assignedTo,
            type: 'todo_assigned',
            title: 'New task assigned to you',
            message: projectInfo 
              ? `${creatorName} assigned you "${todo.title}" in ${projectInfo.name}`
              : `${creatorName} assigned you "${todo.title}"`,
            read: false,
            entityType: 'todo',
            entityId: todo.id,
            metadata: {
              creatorName,
              todoTitle: todo.title,
              projectName: projectInfo?.name,
            },
          });
        }
      }

      res.status(201).json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Rate limiter for batch todo creation - prevent abuse
  const batchTodoRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Max 30 batch creates per window per user
    message: 'Too many batch todo requests, please try again later',
    standardHeaders: true,
    keyGenerator: (req: any) => req.user?.claims?.sub || 'anonymous',
  });

  // Batch todo creation for camera-to-do voice sessions
  app.post("/api/todo-sessions", isAuthenticatedAndWhitelisted, batchTodoRateLimiter, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Validate batch payload
      const validated = batchTodoSchema.parse(req.body);

      // Create all todos in batch (includes security validation)
      const todos = await storage.createTodosBatch(user.id, validated);

      res.status(201).json(todos);
    } catch (error: any) {
      // Map validation errors to 400, others to 500
      if (error.message && (
        error.message.includes('not found') ||
        error.message.includes('required') ||
        error.message.includes('exceed') ||
        error.message.includes('belong') ||
        error.message.includes('removed')
      )) {
        return res.status(400).json({ error: error.message });
      }
      handleError(res, error);
    }
  });

  app.patch("/api/todos/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTodoCompanyAccess(req, res, req.params.id)) return;
      
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Validate request body using partial schema (all fields optional for updates)
      const validated = insertTodoSchema.partial().parse(req.body);

      // If photoId provided, verify photo exists and belongs to user's company
      if (validated.photoId) {
        const photo = await storage.getPhoto(validated.photoId);
        if (!photo) {
          return handleError(res, errors.validation("Photo not found"));
        }
        
        // Verify photo belongs to user's company (either through project or photographer)
        if (photo.projectId) {
          // Photo is attached to a project - verify project access
          const project = await storage.getProject(photo.projectId);
          if (!project || project.companyId !== user.companyId) {
            return handleError(res, errors.validation("Photo does not belong to your company"));
          }
        } else {
          // Standalone photo - verify photographer belongs to same company
          if (photo.photographerId) {
            const photographer = await storage.getUser(photo.photographerId);
            if (!photographer || photographer.companyId !== user.companyId) {
              return handleError(res, errors.validation("Photo does not belong to your company"));
            }
          }
        }
      }

      // If assignedTo is being updated, verify assignee is in same company
      if (validated.assignedTo && validated.assignedTo !== user.id) {
        const assignee = await storage.getUser(validated.assignedTo);
        if (!assignee) {
          return handleError(res, errors.validation("Assignee user not found"));
        }
        if (assignee.companyId !== user.companyId) {
          return handleError(res, errors.validation("Can only assign to-dos to members of your company"));
        }
      }

      // If projectId is being updated, verify access
      if (validated.projectId) {
        if (!await verifyProjectCompanyAccess(req, res, validated.projectId)) return;
      }

      // Get current todo to check if assignee is changing (Integration Task 3)
      const oldTodo = await storage.getTodo(req.params.id);
      if (!oldTodo) {
        return res.status(404).json({ error: "To-do not found" });
      }
      
      const todo = await storage.updateTodo(req.params.id, validated);
      if (!todo) {
        return res.status(404).json({ error: "To-do not found" });
      }

      // Create notification if assignee changed to a different user (Integration Task 3)
      if (validated.assignedTo && validated.assignedTo !== oldTodo.assignedTo && validated.assignedTo !== user.id) {
        const reassignerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
        const projectInfo = todo.projectId ? await storage.getProject(todo.projectId) : null;
        
        await storage.createNotification({
          userId: validated.assignedTo,
          type: 'todo_assigned',
          title: 'Task reassigned to you',
          message: projectInfo 
            ? `${reassignerName} assigned you "${todo.title}" in ${projectInfo.name}`
            : `${reassignerName} assigned you "${todo.title}"`,
          read: false,
          entityType: 'todo',
          entityId: todo.id,
          metadata: {
            reassignerName,
            todoTitle: todo.title,
            projectName: projectInfo?.name,
          },
        });
      }

      res.json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/todos/:id/complete", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTodoCompanyAccess(req, res, req.params.id)) return;
      
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      const todo = await storage.completeTodo(req.params.id, user.id);
      if (!todo) {
        return res.status(404).json({ error: "To-do not found" });
      }
      res.json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/todos/:id/flag", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTodoCompanyAccess(req, res, req.params.id)) return;
      
      const todo = await storage.toggleTodoFlag(req.params.id);
      if (!todo) {
        return res.status(404).json({ error: "To-do not found" });
      }
      res.json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.delete("/api/todos/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTodoCompanyAccess(req, res, req.params.id)) return;
      
      const deleted = await storage.deleteTodo(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "To-do not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Activity Log Routes - accountability and audit trail
  // ========================================

  app.get("/api/activity-logs", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const options = {
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
        entityType: req.query.entityType as string | undefined,
      };

      const logs = await storage.getActivityLogs(user.companyId, options);
      res.json(logs);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Notification Routes
  // ========================================

  app.get("/api/notifications", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const options = {
        unreadOnly: req.query.unreadOnly === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      };

      const notifications = await storage.getNotifications(userId, options);
      res.json(notifications);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify notification belongs to user
      const notification = await storage.getNotifications(userId, { limit: 1000 });
      const notificationToMark = notification.find(n => n.id === req.params.id);
      
      if (!notificationToMark) {
        return res.status(404).json({ error: "Notification not found" });
      }

      const updated = await storage.markNotificationAsRead(req.params.id);
      res.json(updated);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.delete("/api/notifications/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Verify notification belongs to user
      const notifications = await storage.getNotifications(userId, { limit: 1000 });
      const notificationToDelete = notifications.find(n => n.id === req.params.id);
      
      if (!notificationToDelete) {
        return res.status(404).json({ error: "Notification not found" });
      }

      const deleted = await storage.deleteNotification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Clock Entry Routes - time tracking
  // ========================================

  app.post("/api/clock", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const { type, location, notes, projectId } = req.body;

      // Validate type
      const validTypes = ['clock_in', 'clock_out', 'break_start', 'break_end'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: "Invalid clock entry type" });
      }

      // Require projectId for clock_in
      if (type === 'clock_in' && !projectId) {
        return res.status(400).json({ error: "Project selection is required to clock in" });
      }

      // Validate projectId belongs to user's company (if provided)
      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project || project.companyId !== user.companyId) {
          return res.status(400).json({ error: "Invalid project or project does not belong to your company" });
        }
      }

      // Get current status to validate action
      const currentStatus = await storage.getTodayClockStatus(user.id);

      // Validate transitions
      if (type === 'clock_in' && currentStatus.isClockedIn) {
        return res.status(400).json({ error: "Already clocked in" });
      }
      if (type === 'clock_out' && !currentStatus.isClockedIn) {
        return res.status(400).json({ error: "Not clocked in" });
      }
      if (type === 'break_start' && (!currentStatus.isClockedIn || currentStatus.onBreak)) {
        return res.status(400).json({ error: "Must be clocked in and not on break to start break" });
      }
      if (type === 'break_end' && !currentStatus.onBreak) {
        return res.status(400).json({ error: "Not on break" });
      }

      const clockEntry = await storage.createClockEntry({
        userId: user.id,
        companyId: user.companyId,
        projectId: projectId || null,
        type,
        location,
        notes,
        timestamp: new Date(),
      });

      res.json(clockEntry);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/api/clock/status", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await storage.getTodayClockStatus(userId);
      res.json(status);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.get("/api/clock/entries", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const options: { userId?: string; startDate?: Date; endDate?: Date } = {};

      // Filter by specific user (if provided)
      if (req.query.userId) {
        options.userId = req.query.userId as string;
      }

      // Filter by date range
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }

      const entries = await storage.getClockEntries(user.companyId, options);
      res.json(entries);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/clock/switch-project", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const { projectId, location, notes } = req.body;

      // Validate projectId is provided
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required to switch projects" });
      }

      // Validate projectId belongs to user's company
      const project = await storage.getProject(projectId);
      if (!project || project.companyId !== user.companyId) {
        return res.status(400).json({ error: "Invalid project or project does not belong to your company" });
      }

      // Call storage method with transaction safety
      const result = await storage.switchProject(
        user.id,
        user.companyId,
        projectId,
        location,
        notes
      );

      res.json({
        previousEntry: result.clockOutEntry,
        newEntry: result.clockInEntry,
        timestamp: result.clockInEntry.timestamp,
        project,
      });
    } catch (error: any) {
      // Handle specific validation errors from storage
      if (error.message.includes("not currently clocked in") || 
          error.message.includes("same project")) {
        return res.status(400).json({ error: error.message });
      }
      handleError(res, error);
    }
  });

  app.get("/api/timesheets", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user.claims.sub;

      // Date range is required
      if (!req.query.startDate || !req.query.endDate) {
        return res.status(400).json({ error: "startDate and endDate query parameters are required" });
      }

      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const entries = await storage.getClockEntriesForUser(userId, startDate, endDate);
      res.json(entries);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.patch("/api/clock/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const { timestamp, editReason } = req.body;

      if (!timestamp || !editReason) {
        return res.status(400).json({ error: "Timestamp and edit reason are required" });
      }

      // Get the original entry to verify ownership and save original timestamp
      const entries = await storage.getClockEntries(user.companyId, {});
      const originalEntry = entries.find(e => e.id === req.params.id);

      if (!originalEntry) {
        return res.status(404).json({ error: "Clock entry not found" });
      }

      // Allow workers to edit their own entries OR owners to edit any entry
      const canEdit = originalEntry.userId === user.id || user.role === 'owner';
      if (!canEdit) {
        return res.status(403).json({ error: "You can only edit your own clock entries" });
      }

      const updated = await storage.updateClockEntry(req.params.id, {
        timestamp: new Date(timestamp),
        editedBy: user.id,
        editReason,
        originalTimestamp: originalEntry.timestamp,
      });

      res.json(updated);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Geofence Routes - automatic time tracking boundaries
  // ========================================

  // Create geofence (admin only)
  app.post("/api/geofences", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      if (!assertCompanyAdmin(user, res)) return;

      const validatedData = insertGeofenceSchema.parse({
        ...req.body,
        companyId: user.companyId, // Use authenticated user's company
      });

      const geofence = await storage.createGeofence(validatedData);
      res.json(geofence);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get all geofences for company (optionally filter by project)
  app.get("/api/geofences", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      let geofences = await storage.getGeofencesByCompany(user.companyId);

      // Optional project filter
      if (req.query.projectId) {
        geofences = geofences.filter(g => g.projectId === req.query.projectId);
      }

      // Attach project information for each geofence
      const geofencesWithProjects = await Promise.all(
        geofences.map(async (geofence) => {
          if (geofence.projectId) {
            const project = await storage.getProject(geofence.projectId);
            return {
              ...geofence,
              project: project ? { id: project.id, name: project.name } : null,
            };
          }
          return { ...geofence, project: null };
        })
      );

      res.json(geofencesWithProjects);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get single geofence by ID
  app.get("/api/geofences/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const geofence = await storage.getGeofence(req.params.id);
      
      if (!geofence) {
        return res.status(404).json({ error: "Geofence not found" });
      }

      // Verify company ownership
      if (geofence.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(geofence);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Update geofence (admin only)
  app.patch("/api/geofences/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      if (!assertCompanyAdmin(user, res)) return;

      // Verify geofence exists and belongs to company
      const existing = await storage.getGeofence(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Geofence not found" });
      }
      if (existing.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate partial update
      const partialSchema = insertGeofenceSchema.partial();
      const validatedData = partialSchema.parse(req.body);

      const updated = await storage.updateGeofence(req.params.id, validatedData);
      res.json(updated);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Delete geofence (admin only)
  app.delete("/api/geofences/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;
      
      if (!assertCompanyAdmin(user, res)) return;

      // Verify geofence exists and belongs to company
      const existing = await storage.getGeofence(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Geofence not found" });
      }
      if (existing.companyId !== user.companyId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const success = await storage.deleteGeofence(req.params.id);
      res.json({ success });
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Location Log Routes - 5-minute location pings
  // ========================================

  // Create location log (from geofencing plugin)
  app.post("/api/locations", isAuthenticatedAndWhitelisted, locationLogRateLimiter, async (req, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate and create location log
      const validatedData = insertLocationLogSchema.parse({
        ...req.body,
        userId, // Force authenticated user's ID (ignore client-provided userId)
      });

      const locationLog = await storage.createLocationLog(validatedData);
      res.json(locationLog);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get user's own location logs
  app.get("/api/locations/user", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const userId = req.user.claims.sub;

      const options: { startDate?: Date; endDate?: Date } = {};
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
        if (isNaN(options.startDate.getTime())) {
          return res.status(400).json({ error: "Invalid startDate format" });
        }
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
        if (isNaN(options.endDate.getTime())) {
          return res.status(400).json({ error: "Invalid endDate format" });
        }
      }

      const logs = await storage.getLocationLogs(userId, options);
      res.json(logs);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get recent location logs for admin dashboard (owner only)
  app.get("/api/locations/recent", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Only owner can view all users' locations
      if (!assertCompanyAdmin(user, res)) return;

      const minutes = req.query.minutes ? parseInt(req.query.minutes as string) : 5;
      
      if (isNaN(minutes) || minutes < 1 || minutes > 120) {
        return res.status(400).json({ error: "Invalid minutes parameter (1-120)" });
      }

      const logs = await storage.getRecentLocationLogs(user.companyId, minutes);
      res.json(logs);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // User Permission Routes - role-based access control
  // ========================================

  // Create or update user permissions (admin only) - using upsert pattern
  app.post("/api/permissions", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      if (!assertCompanyAdmin(user, res)) return;

      const validatedData = insertUserPermissionSchema.parse(req.body);

      // Check if permission already exists (upsert pattern)
      const existing = await storage.getUserPermission(validatedData.userId);
      
      let permission;
      if (existing) {
        permission = await storage.updateUserPermission(validatedData.userId, validatedData);
      } else {
        permission = await storage.createUserPermission(validatedData);
      }

      res.json(permission);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get user permissions
  app.get("/api/permissions/:userId", isAuthenticatedAndWhitelisted, validateUuidParam('userId'), async (req, res) => {
    try {
      const currentUser = await getUserWithCompany(req, res);
      if (!currentUser) return;

      // Users can view their own permissions, admins can view anyone's
      const targetUserId = req.params.userId;
      if (targetUserId !== currentUser.id && !isCompanyAdmin(currentUser)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify target user is in same company
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.companyId !== currentUser.companyId) {
        return res.status(404).json({ error: "User not found" });
      }

      const permission = await storage.getUserPermission(targetUserId);
      
      if (!permission) {
        return res.status(404).json({ error: "Permissions not found" });
      }

      res.json(permission);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Update user permissions (admin only)
  app.patch("/api/permissions/:userId", isAuthenticatedAndWhitelisted, validateUuidParam('userId'), async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      if (!assertCompanyAdmin(user, res)) return;

      // Verify target user is in same company
      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser || targetUser.companyId !== user.companyId) {
        return res.status(404).json({ error: "User not found" });
      }

      const partialSchema = insertUserPermissionSchema.partial();
      const validatedData = partialSchema.parse(req.body);

      const updated = await storage.updateUserPermission(req.params.userId, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Permissions not found" });
      }

      res.json(updated);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Time Entry Edit Audit Routes
  // ========================================

  // Create time entry edit log (internal use - called when clock entry is edited)
  app.post("/api/time-edits", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      const validatedData = insertTimeEntryEditSchema.parse({
        ...req.body,
        editedBy: user.id, // Force authenticated user as editor
      });

      // Verify clock entry exists and belongs to user's company
      const entries = await storage.getClockEntries(user.companyId, {});
      const clockEntry = entries.find(e => e.id === validatedData.clockEntryId);
      
      if (!clockEntry) {
        return res.status(404).json({ error: "Clock entry not found" });
      }

      const audit = await storage.createTimeEntryEdit(validatedData);
      res.json(audit);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // Get edit history for a time entry
  app.get("/api/time-edits/:clockEntryId", isAuthenticatedAndWhitelisted, validateUuidParam('clockEntryId'), async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Verify clock entry exists and belongs to user's company
      const entries = await storage.getClockEntries(user.companyId, {});
      const clockEntry = entries.find(e => e.id === req.params.clockEntryId);
      
      if (!clockEntry) {
        return res.status(404).json({ error: "Clock entry not found" });
      }

      const edits = await storage.getTimeEntryEdits(req.params.clockEntryId);
      res.json(edits);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Team Stats Routes - for company owners
  // ========================================

  app.get("/api/team-stats/photo-uploads", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Only owner can view team stats
      if (user.role !== 'owner') {
        return res.status(403).json({ error: "Only company owners can view team stats" });
      }

      // Get activity logs for photo uploads
      const logs = await storage.getActivityLogs(user.companyId, {
        action: 'photo_uploaded',
        limit: 1000, // Get more for accurate stats
      });

      // Group by user and count
      const userStats = logs.reduce((acc, log) => {
        const userId = log.userId;
        const userName = `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email || 'Unknown';
        
        if (!acc[userId]) {
          acc[userId] = {
            userId,
            userName,
            photoCount: 0,
          };
        }
        acc[userId].photoCount += 1;
        return acc;
      }, {} as Record<string, { userId: string; userName: string; photoCount: number }>);

      // Convert to array and sort by photo count descending
      const stats = Object.values(userStats).sort((a, b) => b.photoCount - a.photoCount);

      res.json(stats);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  // ========================================
  // Trash operations - 30-day soft delete
  // ========================================
  app.get("/api/trash/projects", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const projects = await storage.getDeletedProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trash/photos", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const photos = await storage.getDeletedPhotos();
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trash/projects/:id/restore", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const restored = await storage.restoreProject(req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trash/photos/:id/restore", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const restored = await storage.restorePhoto(req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/trash/projects/:id", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const deleted = await storage.permanentlyDeleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/trash/photos/:id", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const deleted = await storage.permanentlyDeletePhoto(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trash/cleanup", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      await storage.cleanupOldDeletedItems();
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trash/delete-all", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const result = await storage.permanentlyDeleteAllTrash();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete share - revoke share link
  app.delete("/api/shares/:id", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const deleted = await storage.deleteShare(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Share not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tags - Photo categorization by trade/type
  app.get("/api/tags", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      
      // If querying tags for a specific project, verify user has access to that project
      if (projectId) {
        if (!await verifyProjectCompanyAccess(req, res, projectId)) return;
      }
      
      const tags = await storage.getTags(projectId);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tags", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const validated = insertTagSchema.parse(req.body);
      
      // If creating a project-specific tag, verify user has access to that project
      if (validated.projectId) {
        if (!await verifyProjectCompanyAccess(req, res, validated.projectId)) return;
      }
      
      const tag = await storage.createTag(validated);
      res.status(201).json(tag);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/tags/:id", isAuthenticatedAndWhitelisted, async (req, res) => {
    try {
      if (!await verifyTagCompanyAccess(req, res, req.params.id)) return;
      
      const validated = insertTagSchema.partial().parse(req.body);
      const tag = await storage.updateTag(req.params.id, validated);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json(tag);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/tags/:id", isAuthenticatedAndWhitelisted, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTagCompanyAccess(req, res, req.params.id)) return;
      
      const deleted = await storage.deleteTag(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Photo Tags - Associate tags with photos
  app.get("/api/photos/:photoId/tags", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const photoTags = await storage.getPhotoTags(req.params.photoId);
      res.json(photoTags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/tags", isAuthenticatedAndWhitelisted, validateUuidParam('photoId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const validated = insertPhotoTagSchema.parse({
        photoId: req.params.photoId,
        tagId: req.body.tagId,
      });
      const photoTag = await storage.addPhotoTag(validated);
      res.status(201).json(photoTag);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/photos/:photoId/tags/:tagId", isAuthenticatedAndWhitelisted, validateUuidParams('photoId', 'tagId'), async (req, res) => {
    try {
      const { authorized } = await verifyPhotoCompanyAccess(req, res, req.params.photoId);
      if (!authorized) return;
      
      const deleted = await storage.removePhotoTag(req.params.photoId, req.params.tagId);
      if (!deleted) {
        return res.status(404).json({ error: "Photo tag association not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Email Test Endpoint (for verifying Resend integration)
  app.post("/api/test-email", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const { email, name } = req.body;
      
      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required" });
      }

      // Send test welcome email
      await emailService.sendWelcomeEmail(email, name);
      
      res.json({ 
        success: true, 
        message: `Test email sent to ${email}`,
        from: "FieldSnaps <hello@fieldsnaps.com>"
      });
    } catch (error: any) {
      console.error('[Test Email] Error:', error);
      res.status(500).json({ 
        error: error.message || "Failed to send test email",
        details: error.toString()
      });
    }
  });

  // Billing & Subscription Routes (Stripe Integration)
  // Note: These routes are ready but dormant until production launch
  
  // Get or create subscription for current user
  app.post("/api/billing/subscription", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    // Check if billing is configured (dormant mode check)
    if (!billingService.isConfigured()) {
      console.log("[Billing] Service not configured - dormant mode");
      return res.status(503).json({ 
        error: "Billing service not available",
        message: "Billing is not yet activated for this application" 
      });
    }

    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user already has an active subscription
      const existingSubscription = await storage.getSubscriptionByUserId(user.id);
      
      if (existingSubscription && existingSubscription.stripeSubscriptionId) {
        // Retrieve latest subscription data from Stripe
        const stripeSubscription = await billingService.retrieveSubscription(existingSubscription.stripeSubscriptionId);
        
        const latestInvoice = stripeSubscription.latest_invoice;
        let clientSecret: string | null = null;
        
        if (latestInvoice && typeof latestInvoice === 'object' && 'payment_intent' in latestInvoice) {
          const pi = latestInvoice.payment_intent;
          if (pi && typeof pi === 'object' && 'client_secret' in pi) {
            clientSecret = (pi as any).client_secret || null;
          }
        }
        
        return res.json({
          subscriptionId: stripeSubscription.id,
          clientSecret,
        });
      }

      // Create new Stripe customer if needed
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await billingService.getOrCreateStripeCustomer(user);
        await storage.updateUserStripeCustomerId(user.id, stripeCustomerId);
      }

      // Get Stripe price ID from environment
      const priceId = process.env.STRIPE_PRICE_ID;
      if (!priceId) {
        throw new Error("STRIPE_PRICE_ID not configured");
      }

      // Create subscription with 7-day trial
      const { subscription, clientSecret } = await billingService.createTrialSubscription(
        user,
        stripeCustomerId,
        priceId
      );

      // Calculate trial end date
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      // Save subscription to database
      await storage.createSubscription({
        userId: user.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status,
        currentPeriodStart: 'current_period_start' in subscription && typeof subscription.current_period_start === 'number'
          ? new Date(subscription.current_period_start * 1000) 
          : null,
        currentPeriodEnd: 'current_period_end' in subscription && typeof subscription.current_period_end === 'number'
          ? new Date(subscription.current_period_end * 1000) 
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
      });

      // Update user subscription status
      await storage.updateUserSubscriptionStatus(user.id, "trial", trialEnd);

      // Send welcome email (dormant in development)
      if (user.email) {
        const userName = user.firstName || user.email.split('@')[0];
        await emailService.sendWelcomeEmail(user.email, userName);
      }

      res.json({
        subscriptionId: subscription.id,
        clientSecret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel subscription
  app.post("/api/billing/subscription/cancel", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    // Check if billing is configured (dormant mode check)
    if (!billingService.isConfigured()) {
      console.log("[Billing] Service not configured - dormant mode");
      return res.status(503).json({ 
        error: "Billing service not available",
        message: "Billing is not yet activated for this application" 
      });
    }

    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const subscription = await storage.getSubscriptionByUserId(user.id);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription" });
      }

      const cancelAtPeriodEnd = req.body.cancelAtPeriodEnd !== false; // default true
      const updatedSubscription = await billingService.cancelSubscription(
        subscription.stripeSubscriptionId,
        cancelAtPeriodEnd
      );

      await storage.updateSubscription(subscription.id, {
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end ? 1 : 0,
        status: updatedSubscription.status,
      });

      // Send cancellation email (dormant in development)
      if (user.email && subscription.currentPeriodEnd) {
        const userName = user.firstName || user.email.split('@')[0];
        await emailService.sendCancellationEmail(user.email, userName, subscription.currentPeriodEnd);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reactivate cancelled subscription
  app.post("/api/billing/subscription/reactivate", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    // Check if billing is configured (dormant mode check)
    if (!billingService.isConfigured()) {
      console.log("[Billing] Service not configured - dormant mode");
      return res.status(503).json({ 
        error: "Billing service not available",
        message: "Billing is not yet activated for this application" 
      });
    }

    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const subscription = await storage.getSubscriptionByUserId(user.id);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ error: "No subscription found" });
      }

      const updatedSubscription = await billingService.reactivateSubscription(subscription.stripeSubscriptionId);

      await storage.updateSubscription(subscription.id, {
        cancelAtPeriodEnd: 0,
        status: updatedSubscription.status,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe webhook handler for subscription events
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    // Check if billing is configured (dormant mode check)
    if (!billingService.isConfigured()) {
      console.log("[Billing] Webhook received but service not configured - dormant mode");
      return res.status(503).json({ 
        error: "Billing service not available",
        message: "Billing webhooks not yet activated" 
      });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return res.status(400).send("Missing stripe-signature header");
    }

    try {
      const event = billingService.parseWebhookEvent(req.body, signature);

      // Process different webhook events
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          const dbSubscription = await storage.getSubscriptionByStripeId(subscription.id);
          
          if (dbSubscription) {
            await storage.updateSubscription(dbSubscription.id, {
              status: subscription.status,
              currentPeriodStart: subscription.current_period_start 
                ? new Date(subscription.current_period_start * 1000) 
                : null,
              currentPeriodEnd: subscription.current_period_end 
                ? new Date(subscription.current_period_end * 1000) 
                : null,
              cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
            });

            const userStatus = billingService.mapStripeStatusToUserStatus(subscription.status);
            await storage.updateUserSubscriptionStatus(dbSubscription.userId, userStatus);

            // Log event
            const eventData = billingService.createSubscriptionEventData(dbSubscription.id, event);
            await storage.createSubscriptionEvent(eventData);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const dbSubscription = await storage.getSubscriptionByStripeId(subscription.id);
          
          if (dbSubscription) {
            await storage.updateSubscription(dbSubscription.id, {
              status: "canceled",
            });
            await storage.updateUserSubscriptionStatus(dbSubscription.userId, "canceled");

            // Log event
            const eventData = billingService.createSubscriptionEventData(dbSubscription.id, event);
            await storage.createSubscriptionEvent(eventData);
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;
          
          if (subscriptionId) {
            const dbSubscription = await storage.getSubscriptionByStripeId(subscriptionId);
            if (dbSubscription) {
              // Log payment event
              const eventData = billingService.createSubscriptionEventData(dbSubscription.id, event);
              await storage.createSubscriptionEvent(eventData);

              // Send payment success email (dormant in development)
              const user = await storage.getUser(dbSubscription.userId);
              if (user?.email && dbSubscription.currentPeriodEnd) {
                const userName = user.firstName || user.email.split('@')[0];
                await emailService.sendPaymentSuccessEmail(
                  user.email,
                  userName,
                  invoice.amount_paid,
                  dbSubscription.currentPeriodEnd
                );
              }
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;
          
          if (subscriptionId) {
            const dbSubscription = await storage.getSubscriptionByStripeId(subscriptionId);
            if (dbSubscription) {
              // Update status to past_due
              await storage.updateSubscription(dbSubscription.id, {
                status: "past_due",
              });
              await storage.updateUserSubscriptionStatus(dbSubscription.userId, "past_due");

              // Log payment failure event
              const eventData = billingService.createSubscriptionEventData(dbSubscription.id, event);
              await storage.createSubscriptionEvent(eventData);

              // Send payment failed email (dormant in development)
              const user = await storage.getUser(dbSubscription.userId);
              if (user?.email) {
                const userName = user.firstName || user.email.split('@')[0];
                await emailService.sendPaymentFailedEmail(
                  user.email,
                  userName,
                  invoice.amount_due
                );
              }
            }
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Get current user's subscription status
  app.get("/api/billing/subscription/status", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Even in dormant mode, we can return basic user status
      // Just won't have active Stripe subscription data
      const subscription = billingService.isConfigured() 
        ? await storage.getSubscriptionByUserId(user.id)
        : null;
      
      res.json({
        subscriptionStatus: user.subscriptionStatus || "trial",
        trialEndDate: user.trialEndDate,
        subscription: subscription || null,
        billingConfigured: billingService.isConfigured(),
      });
    } catch (error: any) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Checkout session
  app.post("/api/billing/create-checkout-session", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if billing is configured
      if (!billingService.isConfigured()) {
        console.log("[Billing] Service not configured - dormant mode");
        return res.status(503).json({ 
          error: "Billing service not available",
          message: "Billing is not yet activated for this application" 
        });
      }

      // Get user's company and team size for quantity-based pricing
      const user = await storage.getUser(userId);
      if (!user || !user.companyId) {
        return res.status(400).json({ error: "User must belong to a company to subscribe" });
      }

      const members = await storage.getCompanyMembers(user.companyId);
      const teamSize = members.length;

      // Build success and cancel URLs
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const successUrl = `${baseUrl}/billing/success`;
      const cancelUrl = `${baseUrl}/settings`;

      // Create checkout session with team quantity
      const session = await billingService.createCheckoutSession(userId, successUrl, cancelUrl, teamSize);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[Billing] Error creating checkout session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Stripe Customer Portal session
  app.post("/api/billing/create-portal-session", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found" });
      }

      // Check if billing is configured
      if (!billingService.isConfigured()) {
        console.log("[Billing] Service not configured - dormant mode");
        return res.status(503).json({ 
          error: "Billing service not available",
          message: "Billing is not yet activated for this application" 
        });
      }

      // Build return URL
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const returnUrl = `${baseUrl}/settings`;

      // Create portal session
      const session = await billingService.createPortalSession(user.stripeCustomerId, returnUrl);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[Billing] Error creating portal session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Upload Metrics Endpoints
  // ============================================================================
  
  // Get upload performance metrics
  app.get("/api/uploads/metrics", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hoursAgo = req.query.hours ? parseInt(req.query.hours as string) : 24;
      
      // Get overall stats
      const overallStats = uploadMetrics.getStats({ hoursAgo });
      
      // Get user-specific stats
      const userStats = uploadMetrics.getStats({ userId, hoursAgo });
      
      // Get recent failures for debugging
      const recentFailures = uploadMetrics.getRecentFailures(5);
      
      res.json({
        timeRange: `Last ${hoursAgo} hours`,
        overall: overallStats,
        user: userStats,
        recentFailures: recentFailures.map(f => ({
          method: f.method,
          fileSize: f.fileSizeMB,
          error: f.error,
          timestamp: f.timestamp,
        })),
      });
    } catch (error: any) {
      console.error('[Metrics] Error getting upload metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Apple IAP receipt verification endpoint
  // NOT IMPLEMENTED - Placeholder for future StoreKit integration
  app.post("/api/billing/apple/verify-receipt", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    // SECURITY: This endpoint is disabled until proper receipt verification is implemented
    // Enabling this without Apple server validation would allow users to grant themselves
    // paid subscriptions without actually paying
    
    return res.status(501).json({ 
      error: "Apple In-App Purchase not yet implemented",
      message: "This endpoint requires StoreKit SDK integration and Apple receipt verification. Please use web signup at fieldsnaps.com for now.",
      requiredSteps: [
        "1. Configure products in App Store Connect",
        "2. Implement server-to-server receipt validation with Apple",
        "3. Handle subscription expiration and renewal",
        "4. Test with sandbox environment"
      ]
    });
    
    // TODO: Implement when ready:
    // 1. Extract receiptData and productId from request
    // 2. Send receiptData to Apple's verifyReceipt endpoint
    // 3. Validate response signature and subscription status
    // 4. Check expiration date and auto-renewal status
    // 5. Store receipt for future verification
    // 6. Update company.subscriptionSource = 'apple'
    // 7. Update company.subscriptionStatus based on Apple response
    // 8. Prevent duplicate subscriptions across platforms
  });

  // Google Play purchase verification endpoint
  // NOT IMPLEMENTED - Placeholder for future Play Billing integration
  app.post("/api/billing/google/verify-purchase", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    // SECURITY: This endpoint is disabled until proper purchase token verification is implemented
    // Enabling this without Google API validation would allow users to grant themselves
    // paid subscriptions without actually paying
    
    return res.status(501).json({ 
      error: "Google Play Billing not yet implemented",
      message: "This endpoint requires Play Billing Library integration and Google API verification. Please use web signup at fieldsnaps.com for now.",
      requiredSteps: [
        "1. Configure products in Google Play Console",
        "2. Implement server-to-server purchase verification with Google Play Developer API",
        "3. Enroll in External Offers Program",
        "4. Handle subscription expiration and renewal",
        "5. Report external transactions to Google",
        "6. Test with test accounts"
      ]
    });
    
    // TODO: Implement when ready:
    // 1. Extract purchaseToken, productId, packageName from request
    // 2. Call Google Play Developer API to verify purchase token
    // 3. Validate subscription status and expiration
    // 4. Check acknowledgement status
    // 5. Store purchase token for future verification
    // 6. Update company.subscriptionSource = 'google'
    // 7. Update company.subscriptionStatus based on Google response
    // 8. Prevent duplicate subscriptions across platforms
    // 9. Report transaction to Google External Offers if applicable
  });

  // Get unified subscription status (works for all payment sources)
  app.get("/api/billing/subscription/unified-status", isAuthenticatedAndWhitelisted, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.companyId) {
        return res.status(400).json({ error: "User must belong to a company" });
      }

      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Import the validation service
      const { subscriptionValidationService } = await import('./subscriptionValidation');
      
      // Validate subscription from any source
      const status = await subscriptionValidationService.validateCompanySubscription(company);
      
      // Get display info for UI
      const displayInfo = subscriptionValidationService.getSubscriptionDisplayInfo(company);

      res.json({
        ...status,
        displayInfo,
        teamSize: company.subscriptionQuantity
      });
    } catch (error: any) {
      console.error("[Billing] Error getting unified status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Waitlist signup (public endpoint - no authentication required)
  app.post("/api/waitlist", async (req, res) => {
    try {
      const data = insertWaitlistSchema.parse(req.body);
      const entry = await storage.addToWaitlist(data);
      res.json({ message: "Successfully added to waitlist", entry });
    } catch (error: any) {
      // Check if it's a duplicate email error
      if (error.code === '23505' || error.message?.includes('unique')) {
        return res.status(200).json({ message: "Email already on waitlist" });
      }
      handleError(res, error);
    }
  });

  const httpServer = createServer(app);
  
  // Increase timeout for file uploads to 10 minutes (600,000ms)
  // Mobile networks on construction sites can be slow
  httpServer.timeout = 600000; // 10 minutes
  httpServer.keepAliveTimeout = 610000; // Slightly more than timeout
  httpServer.headersTimeout = 620000; // Slightly more than keepAliveTimeout
  
  return httpServer;
}
