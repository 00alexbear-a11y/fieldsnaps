import { db } from "./db";
import { projects, photos, photoAnnotations, comments } from "../shared/schema";
import type {
  Project, Photo, PhotoAnnotation, Comment,
  InsertProject, InsertPhoto, InsertPhotoAnnotation, InsertComment
} from "../shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  
  // Photos
  getProjectPhotos(projectId: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(data: InsertPhoto): Promise<Photo>;
  deletePhoto(id: string): Promise<boolean>;
  
  // Photo Annotations
  getPhotoAnnotations(photoId: string): Promise<PhotoAnnotation[]>;
  createPhotoAnnotation(data: InsertPhotoAnnotation): Promise<PhotoAnnotation>;
  deletePhotoAnnotation(id: string): Promise<boolean>;
  
  // Comments
  getPhotoComments(photoId: string): Promise<Comment[]>;
  createComment(data: InsertComment): Promise<Comment>;
}

export class DbStorage implements IStorage {
  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(projects.createdAt);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(data: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(data).returning();
    return result[0];
  }

  // Photos
  async getProjectPhotos(projectId: string): Promise<Photo[]> {
    return await db.select().from(photos)
      .where(eq(photos.projectId, projectId))
      .orderBy(photos.createdAt);
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const result = await db.select().from(photos).where(eq(photos.id, id));
    return result[0];
  }

  async createPhoto(data: InsertPhoto): Promise<Photo> {
    const result = await db.insert(photos).values(data).returning();
    return result[0];
  }

  async deletePhoto(id: string): Promise<boolean> {
    const result = await db.delete(photos).where(eq(photos.id, id)).returning();
    return result.length > 0;
  }

  // Photo Annotations
  async getPhotoAnnotations(photoId: string): Promise<PhotoAnnotation[]> {
    return await db.select().from(photoAnnotations)
      .where(eq(photoAnnotations.photoId, photoId))
      .orderBy(photoAnnotations.createdAt);
  }

  async createPhotoAnnotation(data: InsertPhotoAnnotation): Promise<PhotoAnnotation> {
    const result = await db.insert(photoAnnotations).values(data).returning();
    return result[0];
  }

  async deletePhotoAnnotation(id: string): Promise<boolean> {
    const result = await db.delete(photoAnnotations).where(eq(photoAnnotations.id, id)).returning();
    return result.length > 0;
  }

  // Comments
  async getPhotoComments(photoId: string): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.photoId, photoId))
      .orderBy(comments.createdAt);
  }

  async createComment(data: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(data).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
