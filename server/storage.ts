import { db } from "./db";
import { projects, photos, photoAnnotations, comments, users, credentials, shares, tags, photoTags } from "../shared/schema";
import type {
  User, UpsertUser,
  Credential, InsertCredential,
  Project, Photo, PhotoAnnotation, Comment, Share, Tag, PhotoTag,
  InsertProject, InsertPhoto, InsertPhotoAnnotation, InsertComment, InsertShare, InsertTag, InsertPhotoTag
} from "../shared/schema";
import { eq, inArray, isNull, isNotNull, and, lt, count, sql } from "drizzle-orm";

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
  getProjectsWithPhotoCounts(): Promise<(Project & { photoCount: number })[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>; // Soft delete
  
  // Photos
  getProjectPhotos(projectId: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(data: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, data: Partial<InsertPhoto>): Promise<Photo | undefined>;
  deletePhoto(id: string): Promise<boolean>; // Soft delete
  
  // Trash operations
  getDeletedProjects(): Promise<Project[]>;
  getDeletedPhotos(): Promise<Photo[]>;
  restoreProject(id: string): Promise<boolean>;
  restorePhoto(id: string): Promise<boolean>;
  permanentlyDeleteProject(id: string): Promise<boolean>;
  permanentlyDeletePhoto(id: string): Promise<boolean>;
  permanentlyDeleteAllTrash(): Promise<{ projectsDeleted: number; photosDeleted: number }>;
  cleanupOldDeletedItems(): Promise<void>;
  
  // Photo Annotations
  getPhotoAnnotations(photoId: string): Promise<PhotoAnnotation[]>;
  createPhotoAnnotation(data: InsertPhotoAnnotation): Promise<PhotoAnnotation>;
  deletePhotoAnnotation(id: string): Promise<boolean>;
  
  // Comments
  getPhotoComments(photoId: string): Promise<Comment[]>;
  createComment(data: InsertComment): Promise<Comment>;
  
  // Shares
  createShare(data: InsertShare): Promise<Share>;
  getShareByToken(token: string): Promise<Share | undefined>;
  getPhotosByIds(photoIds: string[]): Promise<Photo[]>;
  deleteShare(id: string): Promise<boolean>;
  
  // Tags
  getTags(projectId?: string): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(data: InsertTag): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
  
  // Photo Tags
  getPhotoTags(photoId: string): Promise<(PhotoTag & { tag: Tag })[]>;
  addPhotoTag(data: InsertPhotoTag): Promise<PhotoTag>;
  removePhotoTag(photoId: string, tagId: string): Promise<boolean>;
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
    return await db.select().from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(projects.createdAt);
  }

  async getProjectsWithPhotoCounts(): Promise<(Project & { photoCount: number })[]> {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        address: projects.address,
        latitude: projects.latitude,
        longitude: projects.longitude,
        coverPhotoId: projects.coverPhotoId,
        userId: projects.userId,
        createdAt: projects.createdAt,
        lastActivityAt: projects.lastActivityAt,
        deletedAt: projects.deletedAt,
        photoCount: sql<number>`CAST(COUNT(CASE WHEN ${photos.deletedAt} IS NULL THEN 1 END) AS INTEGER)`,
      })
      .from(projects)
      .leftJoin(photos, eq(photos.projectId, projects.id))
      .where(isNull(projects.deletedAt))
      .groupBy(projects.id)
      .orderBy(projects.createdAt);
    
    return result;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)));
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
    // Soft delete - set deletedAt timestamp
    const result = await db.update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result.length > 0;
  }

  // Photos
  async getProjectPhotos(projectId: string): Promise<Photo[]> {
    return await db.select().from(photos)
      .where(and(eq(photos.projectId, projectId), isNull(photos.deletedAt)))
      .orderBy(photos.createdAt);
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const result = await db.select().from(photos)
      .where(and(eq(photos.id, id), isNull(photos.deletedAt)));
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
    // Soft delete - set deletedAt timestamp
    const result = await db.update(photos)
      .set({ deletedAt: new Date() })
      .where(eq(photos.id, id))
      .returning();
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

  // Shares
  async createShare(data: InsertShare): Promise<Share> {
    const result = await db.insert(shares).values(data).returning();
    return result[0];
  }

  async getShareByToken(token: string): Promise<Share | undefined> {
    const result = await db.select().from(shares).where(eq(shares.token, token));
    return result[0];
  }

  async getPhotosByIds(photoIds: string[]): Promise<Photo[]> {
    if (photoIds.length === 0) return [];
    return await db.select().from(photos)
      .where(and(inArray(photos.id, photoIds), isNull(photos.deletedAt)));
  }

  async deleteShare(id: string): Promise<boolean> {
    const result = await db.delete(shares).where(eq(shares.id, id)).returning();
    return result.length > 0;
  }

  // Trash operations
  async getDeletedProjects(): Promise<Project[]> {
    return await db.select().from(projects)
      .where(isNotNull(projects.deletedAt))
      .orderBy(projects.deletedAt);
  }

  async getDeletedPhotos(): Promise<Photo[]> {
    return await db.select().from(photos)
      .where(isNotNull(photos.deletedAt))
      .orderBy(photos.deletedAt);
  }

  async restoreProject(id: string): Promise<boolean> {
    const result = await db.update(projects)
      .set({ deletedAt: null })
      .where(eq(projects.id, id))
      .returning();
    return result.length > 0;
  }

  async restorePhoto(id: string): Promise<boolean> {
    const result = await db.update(photos)
      .set({ deletedAt: null })
      .where(eq(photos.id, id))
      .returning();
    return result.length > 0;
  }

  async permanentlyDeleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async permanentlyDeletePhoto(id: string): Promise<boolean> {
    const result = await db.delete(photos).where(eq(photos.id, id)).returning();
    return result.length > 0;
  }

  async permanentlyDeleteAllTrash(): Promise<{ projectsDeleted: number; photosDeleted: number }> {
    // Delete all soft-deleted projects
    const deletedProjects = await db.delete(projects)
      .where(isNotNull(projects.deletedAt))
      .returning();
    
    // Delete all soft-deleted photos
    const deletedPhotos = await db.delete(photos)
      .where(isNotNull(photos.deletedAt))
      .returning();
    
    return {
      projectsDeleted: deletedProjects.length,
      photosDeleted: deletedPhotos.length
    };
  }

  async cleanupOldDeletedItems(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete projects older than 30 days
    await db.delete(projects)
      .where(and(
        isNotNull(projects.deletedAt),
        lt(projects.deletedAt, thirtyDaysAgo)
      ));

    // Delete photos older than 30 days
    await db.delete(photos)
      .where(and(
        isNotNull(photos.deletedAt),
        lt(photos.deletedAt, thirtyDaysAgo)
      ));
  }

  // Tags
  async getTags(projectId?: string): Promise<Tag[]> {
    if (projectId) {
      // Get both global tags (projectId = null) and project-specific tags
      return await db.select().from(tags)
        .where(
          sql`${tags.projectId} IS NULL OR ${tags.projectId} = ${projectId}`
        )
        .orderBy(tags.name);
    }
    // Get only global tags
    return await db.select().from(tags)
      .where(isNull(tags.projectId))
      .orderBy(tags.name);
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const result = await db.select().from(tags).where(eq(tags.id, id));
    return result[0];
  }

  async createTag(data: InsertTag): Promise<Tag> {
    const result = await db.insert(tags).values(data).returning();
    return result[0];
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  }

  // Photo Tags
  async getPhotoTags(photoId: string): Promise<(PhotoTag & { tag: Tag })[]> {
    const result = await db
      .select({
        id: photoTags.id,
        photoId: photoTags.photoId,
        tagId: photoTags.tagId,
        createdAt: photoTags.createdAt,
        tag: tags,
      })
      .from(photoTags)
      .innerJoin(tags, eq(photoTags.tagId, tags.id))
      .where(eq(photoTags.photoId, photoId));
    return result;
  }

  async addPhotoTag(data: InsertPhotoTag): Promise<PhotoTag> {
    const result = await db.insert(photoTags).values(data).returning();
    return result[0];
  }

  async removePhotoTag(photoId: string, tagId: string): Promise<boolean> {
    const result = await db.delete(photoTags)
      .where(and(eq(photoTags.photoId, photoId), eq(photoTags.tagId, tagId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DbStorage();
