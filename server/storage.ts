import { db } from "./db";
import { projects, photos, photoAnnotations, comments, users, credentials } from "../shared/schema";
import type {
  User, UpsertUser,
  Credential, InsertCredential,
  Project, Photo, PhotoAnnotation, Comment,
  InsertProject, InsertPhoto, InsertPhotoAnnotation, InsertComment
} from "../shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // WebAuthn Credentials
  getUserCredentials(userId: string): Promise<Credential[]>;
  getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined>;
  createCredential(data: InsertCredential): Promise<Credential>;
  updateCredentialCounter(id: string, counter: number): Promise<void>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Photos
  getProjectPhotos(projectId: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(data: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, data: Partial<InsertPhoto>): Promise<Photo | undefined>;
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
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // WebAuthn Credentials
  async getUserCredentials(userId: string): Promise<Credential[]> {
    return await db.select().from(credentials).where(eq(credentials.userId, userId));
  }

  async getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined> {
    const result = await db.select().from(credentials).where(eq(credentials.credentialId, credentialId));
    return result[0];
  }

  async createCredential(data: InsertCredential): Promise<Credential> {
    const result = await db.insert(credentials).values(data).returning();
    return result[0];
  }

  async updateCredentialCounter(id: string, counter: number): Promise<void> {
    await db.update(credentials).set({ counter }).where(eq(credentials.id, id));
  }

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

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set(data)
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
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

  async updatePhoto(id: string, data: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const result = await db.update(photos)
      .set(data)
      .where(eq(photos.id, id))
      .returning();
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
