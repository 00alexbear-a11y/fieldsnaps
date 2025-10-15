import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "./storage";
import { insertProjectSchema, insertPhotoSchema, insertPhotoAnnotationSchema, insertCommentSchema, insertShareSchema, insertTagSchema, insertPhotoTagSchema } from "../shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupWebAuthn } from "./webauthn";
import { handleError, errors } from "./errorHandler";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { billingService } from "./billing";
import { emailService } from "./email";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for processing
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

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
  
  // Serve uploaded photos
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  // Setup authentication
  await setupAuth(app);
  
  // Setup WebAuthn biometric authentication
  setupWebAuthn(app);

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
  app.put("/api/photos/:photoId/object-url", isAuthenticated, async (req: any, res) => {
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
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Projects - protected routes
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk endpoint to get all projects with photo counts in one query (eliminates N+1)
  app.get("/api/projects/with-counts", isAuthenticated, async (req, res) => {
    try {
      const projectsWithCounts = await storage.getProjectsWithPhotoCounts();
      res.json(projectsWithCounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        throw errors.notFound('Project');
      }
      
      // Update project's last activity timestamp when viewed
      await storage.updateProject(req.params.id, { lastActivityAt: new Date() });
      
      res.json(project);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
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
      
      const project = await storage.createProject(validated);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
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

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
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
  app.post("/api/projects/:id/share", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
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
  app.get("/api/projects/:projectId/photos", isAuthenticated, async (req, res) => {
    try {
      const photos = await storage.getProjectPhotos(req.params.projectId);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/photos/:id", isAuthenticated, async (req, res) => {
    try {
      const photo = await storage.getPhoto(req.params.id);
      if (!photo) {
        throw errors.notFound('Photo');
      }
      res.json(photo);
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.post("/api/projects/:projectId/photos", isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      if (!req.file) {
        throw errors.badRequest("No photo file provided");
      }

      const userId = req.user?.claims?.sub;
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

  app.patch("/api/photos/:id", isAuthenticated, upload.single('photo'), async (req: any, res) => {
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

  app.delete("/api/photos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // Security: Verify photo ownership before allowing deletion
      const existingPhoto = await storage.getPhoto(req.params.id);
      if (!existingPhoto) {
        return res.status(404).json({ error: "Photo not found" });
      }
      if (existingPhoto.photographerId !== userId) {
        return res.status(403).json({ error: "You don't have permission to delete this photo" });
      }
      
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
  app.get("/api/photos/:photoId/annotations", isAuthenticated, async (req, res) => {
    try {
      const annotations = await storage.getPhotoAnnotations(req.params.photoId);
      res.json(annotations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/annotations", isAuthenticated, async (req, res) => {
    try {
      const validated = insertPhotoAnnotationSchema.parse({
        ...req.body,
        photoId: req.params.photoId,
      });
      const annotation = await storage.createPhotoAnnotation(validated);
      res.status(201).json(annotation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/annotations/:id", isAuthenticated, async (req, res) => {
    try {
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
  app.get("/api/photos/:photoId/comments", isAuthenticated, async (req, res) => {
    try {
      const comments = await storage.getPhotoComments(req.params.photoId);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/comments", isAuthenticated, async (req, res) => {
    try {
      const validated = insertCommentSchema.parse({
        ...req.body,
        photoId: req.params.photoId,
      });
      const comment = await storage.createComment(validated);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
      const tags = await storage.getTags(projectId);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tags", isAuthenticated, async (req, res) => {
    try {
      const validated = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validated);
      res.status(201).json(tag);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/tags/:id", isAuthenticated, async (req, res) => {
    try {
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
  app.get("/api/photos/:photoId/tags", isAuthenticated, async (req, res) => {
    try {
      const photoTags = await storage.getPhotoTags(req.params.photoId);
      res.json(photoTags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/tags", isAuthenticated, async (req, res) => {
    try {
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

  app.delete("/api/photos/:photoId/tags/:tagId", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.removePhotoTag(req.params.photoId, req.params.tagId);
      if (!deleted) {
        return res.status(404).json({ error: "Photo tag association not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  const httpServer = createServer(app);
  return httpServer;
}
