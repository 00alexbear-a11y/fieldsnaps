import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "./storage";
import { insertProjectSchema, insertPhotoSchema, insertPhotoAnnotationSchema, insertCommentSchema, insertShareSchema, insertTagSchema, insertPhotoTagSchema, insertTaskSchema, insertTodoSchema } from "../shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupWebAuthn } from "./webauthn";
import { handleError, errors } from "./errorHandler";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { billingService } from "./billing";
import { emailService } from "./email";

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
];

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for processing
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    files: 1, // Only allow single file upload per request
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

// UUID validation middleware for route parameters
import { z } from 'zod';

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

// Helper to get authenticated user with company
async function getUserWithCompany(req: any, res: any) {
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

  return user;
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
async function verifyPhotoCompanyAccess(req: any, res: any, photoId: string): Promise<boolean> {
  const photo = await storage.getPhoto(photoId);
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

  // Setup authentication
  await setupAuth(app);
  
  // Setup WebAuthn biometric authentication
  setupWebAuthn(app);

  // ========================================
  // Company Routes
  // ========================================

  // Create company during onboarding
  app.post("/api/companies", isAuthenticated, async (req: any, res) => {
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
  app.get("/api/companies/me", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/companies/invite-link", isAuthenticated, async (req: any, res) => {
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
  app.delete("/api/companies/invite-link", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/companies/invite/:token/accept", isAuthenticated, async (req: any, res) => {
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
  app.get("/api/companies/members", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/companies/members/:userId", isAuthenticated, validateUuidParam('userId'), async (req: any, res) => {
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

  app.put("/api/companies/members/:userId/promote", isAuthenticated, validateUuidParam('userId'), async (req: any, res) => {
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

  // Object Storage routes - Referenced from blueprint:javascript_object_storage
  // Endpoint for serving private objects (photos) with ACL checks
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint for setting ACL policy after photo upload and updating photo URL
  app.put("/api/photos/:photoId/object-url", isAuthenticated, validateUuidParam('photoId'), async (req: any, res) => {
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
  app.get('/api/auth/user', async (req: any, res) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Try real authentication first
    if (req.isAuthenticated() && req.user?.claims?.sub) {
      try {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        return res.json(user);
      } catch (error) {
        console.error("Error fetching authenticated user:", error);
        return res.status(500).json({ message: "Failed to fetch user" });
      }
    }
    
    // Development fallback when OAuth session fails
    if (isDevelopment) {
      try {
        const devUserId = 'dev-user-local';
        let devUser = await storage.getUser(devUserId);
        
        if (!devUser) {
          // Create dev user if doesn't exist
          devUser = await storage.upsertUser({
            id: devUserId,
            email: 'dev@fieldsnaps.local',
            firstName: 'Dev',
            lastName: 'User',
            profileImageUrl: null,
          });
          console.log('[Auth] Created development user');
        }
        
        return res.json(devUser);
      } catch (error) {
        console.error("Error creating dev user:", error);
        return res.status(500).json({ message: "Failed to create dev user" });
      }
    }
    
    // Production or no session - require authentication
    return res.status(401).json({ message: 'Unauthorized' });
  });

  // Projects - protected routes
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
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
  app.get("/api/projects/with-counts", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/projects/:id", isAuthenticated, validateUuidParam('id'), async (req: any, res) => {
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

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      
      // Geocode address if provided
      if (validated.address) {
        try {
          const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(validated.address)}&key=${apiKey}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();
            
            if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
              const location = geocodeData.results[0].geometry.location;
              validated.latitude = location.lat.toString();
              validated.longitude = location.lng.toString();
            } else {
              console.warn('Geocoding failed:', geocodeData.status);
            }
          }
        } catch (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          // Continue without geocoding if it fails
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
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, validateUuidParam('id'), async (req: any, res) => {
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
      
      // Geocode address if provided
      if (validated.address) {
        try {
          const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(validated.address)}&key=${apiKey}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();
            
            if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
              const location = geocodeData.results[0].geometry.location;
              validated.latitude = location.lat.toString();
              validated.longitude = location.lng.toString();
            } else {
              console.warn('Geocoding failed:', geocodeData.status);
            }
          }
        } catch (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          // Continue without geocoding if it fails
        }
      }
      
      const updated = await storage.updateProject(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id/toggle-complete", isAuthenticated, async (req: any, res) => {
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
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, validateUuidParam('id'), async (req: any, res) => {
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
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Project sharing - generate or get share token
  app.post("/api/projects/:id/share", isAuthenticated, async (req: any, res) => {
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

      // Check if share already exists
      const existingShare = await storage.getShareByProjectId(req.params.id);
      if (existingShare) {
        return res.json({ token: existingShare.token });
      }

      // Generate random 32-character token
      const token = Array.from(
        { length: 32 },
        () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
      ).join('');

      const share = await storage.createShare({
        token,
        projectId: req.params.id,
        expiresAt: null, // Never expires
      });

      res.json({ token: share.token });
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
        return res.status(404).json({ error: "Share has expired" });
      }

      // Get project and active photos (excluding trash)
      const project = await storage.getProject(share.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const photos = await storage.getProjectPhotos(share.projectId);

      res.json({
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
          photographerName: photo.photographerName,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Photos
  app.get("/api/projects/:projectId/photos", isAuthenticated, validateUuidParam('projectId'), async (req, res) => {
    try {
      if (!await verifyProjectCompanyAccess(req, res, req.params.projectId)) return;
      
      const photos = await storage.getProjectPhotos(req.params.projectId);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/photos/:id", isAuthenticated, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.id)) return;
      
      const photo = await storage.getPhoto(req.params.id);
      if (!photo) {
        throw errors.notFound('Photo');
      }
      res.json(photo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/projects/:projectId/photos", isAuthenticated, validateUuidParam('projectId'), upload.single('photo'), async (req: any, res) => {
    try {
      if (!await verifyProjectCompanyAccess(req, res, req.params.projectId)) return;
      
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
          visibility: "private", // Photos are private by default, share flow can make them public
        }
      );

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
        mediaType: req.body.mediaType || 'photo', // Default to 'photo' if not provided
        caption: req.body.caption || req.file.originalname,
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
      
      res.status(201).json(photo);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      handleError(res, error);
    }
  });

  app.patch("/api/photos/:id", isAuthenticated, validateUuidParam('id'), upload.single('photo'), async (req: any, res) => {
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
      
      // Handle annotations
      if (req.body.annotations !== undefined) {
        updateData.annotations = req.body.annotations || null;
      }
      
      // Handle caption
      if (req.body.caption !== undefined) {
        updateData.caption = req.body.caption;
      }
      
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

  app.delete("/api/photos/:id", isAuthenticated, validateUuidParam('id'), async (req: any, res) => {
    try {
      // Security: Verify company access (any team member can delete their company's photos)
      if (!await verifyPhotoCompanyAccess(req, res, req.params.id)) return;
      
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
  app.get("/api/photos/:photoId/annotations", isAuthenticated, validateUuidParam('photoId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
      const annotations = await storage.getPhotoAnnotations(req.params.photoId);
      res.json(annotations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/annotations", isAuthenticated, validateUuidParam('photoId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
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

  app.delete("/api/annotations/:id", isAuthenticated, async (req, res) => {
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
  app.get("/api/photos/:photoId/comments", isAuthenticated, validateUuidParam('photoId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
      const comments = await storage.getPhotoComments(req.params.photoId);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/comments", isAuthenticated, validateUuidParam('photoId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
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
  app.post("/api/tasks", isAuthenticated, async (req, res) => {
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

  app.get("/api/projects/:projectId/tasks", isAuthenticated, validateUuidParam('projectId'), async (req, res) => {
    try {
      if (!await verifyProjectCompanyAccess(req, res, req.params.projectId)) return;
      
      const tasks = await storage.getProjectTasks(req.params.projectId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tasks/my-tasks", isAuthenticated, async (req, res) => {
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

  app.put("/api/tasks/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/tasks/:id/complete", isAuthenticated, async (req, res) => {
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

  app.post("/api/tasks/:id/restore", isAuthenticated, async (req, res) => {
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

  app.delete("/api/tasks/:id", isAuthenticated, validateUuidParam('id'), async (req, res) => {
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
  app.get("/api/todos", isAuthenticated, async (req, res) => {
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

  app.get("/api/todos/:id", isAuthenticated, validateUuidParam('id'), async (req, res) => {
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

  app.post("/api/todos", isAuthenticated, async (req, res) => {
    try {
      const user = await getUserWithCompany(req, res);
      if (!user) return;

      // Verify assignee is in same company (allow self-assignment)
      if (req.body.assignedTo !== user.id) {
        const assignee = await storage.getUser(req.body.assignedTo);
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
        createdBy: user.id,
      });
      
      const todo = await storage.createTodo(validated);
      res.status(201).json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.patch("/api/todos/:id", isAuthenticated, validateUuidParam('id'), async (req, res) => {
    try {
      if (!await verifyTodoCompanyAccess(req, res, req.params.id)) return;
      
      const todo = await storage.updateTodo(req.params.id, req.body);
      if (!todo) {
        return res.status(404).json({ error: "To-do not found" });
      }
      res.json(todo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/todos/:id/complete", isAuthenticated, validateUuidParam('id'), async (req, res) => {
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

  app.delete("/api/todos/:id", isAuthenticated, validateUuidParam('id'), async (req, res) => {
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

  // Trash operations - 30-day soft delete
  app.get("/api/trash/projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getDeletedProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/trash/photos", isAuthenticated, async (req, res) => {
    try {
      const photos = await storage.getDeletedPhotos();
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trash/projects/:id/restore", isAuthenticated, async (req, res) => {
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

  app.post("/api/trash/photos/:id/restore", isAuthenticated, async (req, res) => {
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

  app.delete("/api/trash/projects/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/trash/photos/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/trash/cleanup", isAuthenticated, async (req, res) => {
    try {
      await storage.cleanupOldDeletedItems();
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trash/delete-all", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.permanentlyDeleteAllTrash();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete share - revoke share link
  app.delete("/api/shares/:id", isAuthenticated, async (req, res) => {
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
  app.get("/api/tags", isAuthenticated, async (req, res) => {
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

  app.post("/api/tags", isAuthenticated, async (req: any, res) => {
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

  app.put("/api/tags/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/tags/:id", isAuthenticated, validateUuidParam('id'), async (req, res) => {
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
  app.get("/api/photos/:photoId/tags", isAuthenticated, validateUuidParam('photoId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
      const photoTags = await storage.getPhotoTags(req.params.photoId);
      res.json(photoTags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/tags", isAuthenticated, validateUuidParam('photoId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
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

  app.delete("/api/photos/:photoId/tags/:tagId", isAuthenticated, validateUuidParams('photoId', 'tagId'), async (req, res) => {
    try {
      if (!await verifyPhotoCompanyAccess(req, res, req.params.photoId)) return;
      
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
  app.post("/api/test-email", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/billing/subscription", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/billing/subscription/cancel", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/billing/subscription/reactivate", isAuthenticated, async (req: any, res) => {
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
  app.get("/api/billing/subscription/status", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: any, res) => {
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
      const baseUrl = process.env.REPLIT_DEPLOYMENT ? 
        `https://${process.env.REPLIT_DEPLOYMENT}` : 
        `http://localhost:5000`;
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
  app.post("/api/billing/create-portal-session", isAuthenticated, async (req: any, res) => {
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
      const baseUrl = process.env.REPLIT_DEPLOYMENT ? 
        `https://${process.env.REPLIT_DEPLOYMENT}` : 
        `http://localhost:5000`;
      const returnUrl = `${baseUrl}/settings`;

      // Create portal session
      const session = await billingService.createPortalSession(user.stripeCustomerId, returnUrl);

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("[Billing] Error creating portal session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
