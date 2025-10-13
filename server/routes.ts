import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "./storage";
import { insertProjectSchema, insertPhotoSchema, insertPhotoAnnotationSchema, insertCommentSchema, insertShareSchema } from "../shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupWebAuthn } from "./webauthn";

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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
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
        return res.status(404).json({ error: "Photo not found" });
      }
      res.json(photo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/photos", isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo file provided" });
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'photos');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generate unique filename
      const filename = `${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname || '.jpg')}`;
      const filepath = path.join(uploadsDir, filename);

      // Save file to disk
      await fs.writeFile(filepath, req.file.buffer);

      // Create photo URL
      const url = `/uploads/photos/${filename}`;

      // Get photographer info from auth or request body (for offline support)
      let photographerId = req.body.photographerId;
      let photographerName = req.body.photographerName;
      
      if (req.user) {
        photographerId = req.user.claims.sub;
        photographerName = req.user.claims.name || req.user.claims.email;
      }

      // Store photo metadata in database
      const validated = insertPhotoSchema.parse({
        projectId: req.params.projectId,
        url,
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
      
      res.status(201).json(photo);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/photos/:id", isAuthenticated, async (req, res) => {
    try {
      const validated = insertPhotoSchema.partial().parse(req.body);
      const updated = await storage.updatePhoto(req.params.id, validated);
      if (!updated) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/photos/:id", isAuthenticated, async (req, res) => {
    try {
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

  // Shares - Photo sharing via link
  app.post("/api/shares", isAuthenticated, async (req, res) => {
    try {
      // Generate a unique token
      const token = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
      
      // Set expiration to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const validated = insertShareSchema.parse({
        ...req.body,
        token,
        expiresAt,
      });
      
      const share = await storage.createShare(validated);
      res.status(201).json(share);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Public route - no auth required
  app.get("/api/shares/:token", async (req, res) => {
    try {
      const share = await storage.getShareByToken(req.params.token);
      if (!share) {
        return res.status(404).json({ error: "Share not found" });
      }
      
      // Check if expired
      if (new Date() > new Date(share.expiresAt)) {
        return res.status(410).json({ error: "Share link has expired" });
      }
      
      // Get the photos for this share
      const photos = await storage.getPhotosByIds(share.photoIds);
      
      // Get project info
      const project = await storage.getProject(share.projectId);
      
      res.json({
        share,
        photos,
        project,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
