import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertPhotoSchema, insertPhotoAnnotationSchema, insertCommentSchema } from "../shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

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

  // Projects (no auth required - offline-first design)
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
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

  app.post("/api/projects", async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validated);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Photos
  app.get("/api/projects/:projectId/photos", async (req, res) => {
    try {
      const photos = await storage.getProjectPhotos(req.params.projectId);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/photos", async (req, res) => {
    try {
      const validated = insertPhotoSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });
      const photo = await storage.createPhoto(validated);
      res.status(201).json(photo);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/photos/:id", async (req, res) => {
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
  app.get("/api/photos/:photoId/annotations", async (req, res) => {
    try {
      const annotations = await storage.getPhotoAnnotations(req.params.photoId);
      res.json(annotations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/annotations", async (req, res) => {
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

  app.delete("/api/annotations/:id", async (req, res) => {
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
  app.get("/api/photos/:photoId/comments", async (req, res) => {
    try {
      const comments = await storage.getPhotoComments(req.params.photoId);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/photos/:photoId/comments", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
