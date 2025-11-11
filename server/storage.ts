import { db } from "./db";
import { companies, projects, photos, photoAnnotations, comments, users, userSettings, credentials, shares, shareViewLogs, tags, photoTags, pdfs, tasks, todos, subscriptions, subscriptionEvents, waitlist, activityLogs, notifications, projectFavorites, projectVisits, clockEntries, geofences, locationLogs, userPermissions, timeEntryEdits } from "../shared/schema";
import type {
  Company, InsertCompany,
  User, UpsertUser,
  UserSettings, UpdateUserSettings,
  Credential, InsertCredential,
  Project, Photo, PhotoAnnotation, Comment, Share, ShareViewLog, Tag, PhotoTag, Pdf, Task, ToDo,
  Subscription, SubscriptionEvent, Waitlist, ActivityLog, Notification, ProjectFavorite, ProjectVisit, ClockEntry,
  Geofence, LocationLog, UserPermission, TimeEntryEdit,
  InsertProject, InsertPhoto, InsertPhotoAnnotation, InsertComment, InsertShare, InsertShareViewLog, InsertTag, InsertPhotoTag, InsertPdf, InsertTask, InsertToDo,
  InsertSubscription, InsertSubscriptionEvent, InsertWaitlist, InsertActivityLog, InsertNotification, InsertProjectFavorite, InsertProjectVisit, InsertClockEntry,
  InsertGeofence, InsertLocationLog, InsertUserPermission, InsertTimeEntryEdit,
  BatchTodoInput
} from "../shared/schema";
import { eq, inArray, isNull, isNotNull, and, lt, count, sql, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ObjectStorageService } from "./objectStorage";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(userId: string, data: Partial<User>): Promise<User | undefined>;
  
  // User Settings operations
  getUserSettings(userId: string): Promise<UserSettings>;
  updateUserSettings(userId: string, data: UpdateUserSettings): Promise<UserSettings>;
  
  // Company operations
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByOwnerId(ownerId: string): Promise<Company | undefined>;
  getCompanyByInviteToken(token: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  generateInviteLink(companyId: string): Promise<Company>;
  revokeInviteLink(companyId: string): Promise<Company>;
  getCompanyMembers(companyId: string): Promise<User[]>;
  removeUserFromCompany(userId: string): Promise<User | undefined>;
  
  // WebAuthn Credentials
  getUserCredentials(userId: string): Promise<Credential[]>;
  getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined>;
  createCredential(data: InsertCredential): Promise<Credential>;
  updateCredentialCounter(id: string, counter: number): Promise<void>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProjectsByCompany(companyId: string): Promise<Project[]>;
  getProjectsWithPhotoCounts(): Promise<(Project & { photoCount: number })[]>;
  getProjectsByCompanyWithPhotoCounts(companyId: string): Promise<(Project & { photoCount: number, coverPhoto?: Photo })[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>; // Soft delete
  toggleProjectCompletion(id: string): Promise<Project | undefined>;
  trackProjectVisit(userId: string, projectId: string): Promise<ProjectVisit>; // Record user visit
  toggleProjectFavorite(userId: string, projectId: string, isFavorite: boolean): Promise<ProjectFavorite | boolean>; // Toggle user favorite (returns favorite record if added, false if removed)
  getUserFavoriteProjectIds(userId: string): Promise<string[]>; // Get project IDs user has favorited
  getUserRecentProjectIds(userId: string, limit?: number): Promise<string[]>; // Get recently visited project IDs for user
  
  // Photos
  getProjectPhotos(projectId: string, options?: { limit?: number; cursor?: string }): Promise<{ photos: Photo[]; nextCursor?: string }>;
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
  getPhotoAnnotation(id: string): Promise<PhotoAnnotation | undefined>;
  getPhotoAnnotations(photoId: string): Promise<(PhotoAnnotation & { user?: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]>;
  createPhotoAnnotation(data: InsertPhotoAnnotation): Promise<PhotoAnnotation>;
  deletePhotoAnnotation(id: string): Promise<boolean>;
  
  // Comments
  getPhotoComments(photoId: string): Promise<(Comment & { user?: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]>;
  createComment(data: InsertComment): Promise<Comment>;
  
  // Shares
  createShare(data: InsertShare): Promise<Share>;
  getShareByToken(token: string): Promise<Share | undefined>;
  getShareByProjectId(projectId: string): Promise<Share | undefined>;
  deleteShare(id: string): Promise<boolean>;
  
  // Share View Logs
  createShareViewLog(data: InsertShareViewLog): Promise<ShareViewLog>;
  getShareViewLogs(shareId: string): Promise<ShareViewLog[]>;
  
  // Tags
  getTags(projectId?: string): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(data: InsertTag): Promise<Tag>;
  updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;
  
  // Photo Tags
  getPhotoTags(photoId: string): Promise<(PhotoTag & { tag: Tag })[]>;
  addPhotoTag(data: InsertPhotoTag): Promise<PhotoTag>;
  removePhotoTag(photoId: string, tagId: string): Promise<boolean>;
  
  // PDFs
  getPdf(id: string): Promise<Pdf | undefined>;
  getProjectPdfs(projectId: string): Promise<Pdf[]>;
  createPdf(data: InsertPdf): Promise<Pdf>;
  deletePdf(id: string): Promise<boolean>;
  
  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getProjectTasks(projectId: string): Promise<Task[]>;
  getTasksAssignedToUser(userId: string): Promise<(Task & { project: { id: string; name: string } })[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: string, userId: string): Promise<Task | undefined>;
  restoreTask(id: string): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  
  // ToDos
  getTodo(id: string): Promise<ToDo | undefined>;
  getTodos(companyId: string, userId: string, filters?: { projectId?: string; completed?: boolean; flag?: boolean; dueToday?: boolean; view?: 'my-tasks' | 'team-tasks' | 'i-created' | 'flagged' }): Promise<(ToDo & { project?: { id: string; name: string }; photo?: { id: string; url: string }; assignee: { id: string; firstName: string | null; lastName: string | null }; creator: { id: string; firstName: string | null; lastName: string | null } })[]>;
  createTodo(data: InsertToDo): Promise<ToDo>;
  createTodosBatch(userId: string, data: BatchTodoInput): Promise<ToDo[]>; // Batch creation for camera-to-do voice sessions
  updateTodo(id: string, data: Partial<InsertToDo>): Promise<ToDo | undefined>;
  completeTodo(id: string, userId: string): Promise<ToDo | undefined>;
  toggleTodoFlag(id: string): Promise<ToDo | undefined>;
  deleteTodo(id: string): Promise<boolean>;
  
  // Billing & Subscriptions
  updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User | undefined>;
  updateUserSubscriptionStatus(userId: string, status: string, trialEndDate?: Date): Promise<User | undefined>;
  startUserTrial(userId: string): Promise<User | undefined>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | undefined>;
  getSubscriptionByCompanyId(companyId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  createSubscriptionEvent(data: InsertSubscriptionEvent): Promise<SubscriptionEvent>;
  getSubscriptionEvents(subscriptionId: string): Promise<SubscriptionEvent[]>;
  
  // PKCE OAuth Storage (in-memory for native app OAuth)
  storePKCEVerifier(state: string, verifier: string, expiresInMs?: number): Promise<void>;
  getPKCEVerifier(state: string): Promise<string | undefined>;
  deletePKCEVerifier(state: string): Promise<void>;
  cleanupExpiredPKCE(): Promise<void>;
  
  // Waitlist operations
  addToWaitlist(data: InsertWaitlist): Promise<Waitlist>;
  getWaitlistEntries(): Promise<Waitlist[]>;
  
  // Activity logs (for accountability and audit trail)
  createActivityLog(data: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(companyId: string, options?: { limit?: number; userId?: string; action?: string; entityType?: string }): Promise<(ActivityLog & { user: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]>;
  
  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  deleteNotification(id: string): Promise<boolean>;
  
  // Clock Entries (time tracking)
  createClockEntry(data: InsertClockEntry): Promise<ClockEntry>;
  getClockEntries(companyId: string, options?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<(ClockEntry & { user: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]>;
  getTodayClockStatus(userId: string): Promise<{ isClockedIn: boolean; onBreak: boolean; clockInTime?: Date; totalHoursToday: number; currentProjectId?: string | null }>;
  getClockEntriesForUser(userId: string, startDate: Date, endDate: Date): Promise<ClockEntry[]>;
  updateClockEntry(id: string, data: { timestamp: Date; editedBy: string; editReason: string; originalTimestamp: Date }): Promise<ClockEntry | undefined>;
  switchProject(userId: string, companyId: string, newProjectId: string, location?: string, notes?: string): Promise<{ clockOutEntry: ClockEntry; clockInEntry: ClockEntry }>;
  
  // Geofences (automatic time tracking boundaries)
  createGeofence(data: InsertGeofence): Promise<Geofence>;
  getGeofence(id: string): Promise<Geofence | undefined>;
  getGeofencesByCompany(companyId: string): Promise<Geofence[]>;
  getGeofencesByProject(projectId: string): Promise<Geofence[]>;
  updateGeofence(id: string, data: Partial<InsertGeofence>): Promise<Geofence | undefined>;
  deleteGeofence(id: string): Promise<boolean>;
  
  // Location Logs (5-minute location pings when clocked in)
  createLocationLog(data: InsertLocationLog): Promise<LocationLog>;
  getLocationLogs(userId: string, options?: { startDate?: Date; endDate?: Date }): Promise<LocationLog[]>;
  getRecentLocationLogs(companyId: string, minutes?: number): Promise<(LocationLog & { user: { id: string; firstName: string | null; lastName: string | null }; project?: { id: string; name: string } | null })[]>;
  
  // User Permissions (role-based access control)
  createUserPermission(data: InsertUserPermission): Promise<UserPermission>;
  getUserPermission(userId: string): Promise<UserPermission | undefined>;
  updateUserPermission(userId: string, data: Partial<InsertUserPermission>): Promise<UserPermission | undefined>;
  deleteUserPermission(userId: string): Promise<boolean>;
  
  // Time Entry Edits (audit trail for time modifications)
  createTimeEntryEdit(data: InsertTimeEntryEdit): Promise<TimeEntryEdit>;
  getTimeEntryEdits(clockEntryId: string): Promise<(TimeEntryEdit & { editor: { id: string; firstName: string | null; lastName: string | null } })[]>;
}

export class DbStorage implements IStorage {
  private objectStorageService = new ObjectStorageService();
  
  // In-memory storage for PKCE verifiers (temporary, expires after 10 minutes)
  private pkceStore = new Map<string, { verifier: string; expiresAt: number }>();

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

  async updateUser(userId: string, data: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  // User Settings operations
  async getUserSettings(userId: string): Promise<UserSettings> {
    // Try to get existing settings
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    
    if (result[0]) {
      return result[0];
    }
    
    // Create default settings if they don't exist
    const newSettings = await db.insert(userSettings)
      .values({ userId, uploadOnWifiOnly: true })
      .returning();
    
    return newSettings[0];
  }

  async updateUserSettings(userId: string, data: UpdateUserSettings): Promise<UserSettings> {
    // First ensure settings exist
    await this.getUserSettings(userId);
    
    // Update settings
    const result = await db.update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    
    return result[0];
  }

  // Company operations
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanyByOwnerId(ownerId: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.ownerId, ownerId));
    return result[0];
  }

  async getCompanyByInviteToken(token: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.inviteLinkToken, token));
    return result[0];
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(data).returning();
    return result[0];
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const result = await db.update(companies)
      .set(data)
      .where(eq(companies.id, id))
      .returning();
    return result[0];
  }

  async generateInviteLink(companyId: string): Promise<Company> {
    // Generate a random 32-character token
    const token = crypto.randomUUID().replace(/-/g, '');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await db.update(companies)
      .set({
        inviteLinkToken: token,
        inviteLinkUses: 0,
        inviteLinkMaxUses: 5,
        inviteLinkExpiresAt: expiresAt,
      })
      .where(eq(companies.id, companyId))
      .returning();
    return result[0];
  }

  async revokeInviteLink(companyId: string): Promise<Company> {
    const result = await db.update(companies)
      .set({
        inviteLinkToken: null,
        inviteLinkUses: 0,
        inviteLinkExpiresAt: null,
      })
      .where(eq(companies.id, companyId))
      .returning();
    return result[0];
  }

  async getCompanyMembers(companyId: string): Promise<User[]> {
    return await db.select().from(users)
      .where(and(eq(users.companyId, companyId), isNull(users.removedAt)))
      .orderBy(users.createdAt);
  }

  async removeUserFromCompany(userId: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ 
        removedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
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

  async getProjectsByCompany(companyId: string): Promise<Project[]> {
    return await db.select().from(projects)
      .where(and(eq(projects.companyId, companyId), isNull(projects.deletedAt)))
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
        companyId: projects.companyId,
        createdBy: projects.createdBy,
        userId: projects.userId,
        createdAt: projects.createdAt,
        lastActivityAt: projects.lastActivityAt,
        deletedAt: projects.deletedAt,
        completed: projects.completed,
        unitCount: projects.unitCount,
        unitLabels: projects.unitLabels,
        photoCount: sql<number>`CAST(COUNT(CASE WHEN ${photos.deletedAt} IS NULL THEN ${photos.id} END) AS INTEGER)`,
      })
      .from(projects)
      .leftJoin(photos, eq(photos.projectId, projects.id))
      .where(isNull(projects.deletedAt))
      .groupBy(projects.id)
      .orderBy(projects.createdAt);
    
    return result;
  }

  async getProjectsByCompanyWithPhotoCounts(companyId: string): Promise<(Project & { photoCount: number, coverPhoto?: Photo })[]> {
    // Create an alias for cover photo join
    const coverPhoto = alias(photos, 'cover_photo');
    
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        address: projects.address,
        latitude: projects.latitude,
        longitude: projects.longitude,
        coverPhotoId: projects.coverPhotoId,
        companyId: projects.companyId,
        createdBy: projects.createdBy,
        userId: projects.userId,
        createdAt: projects.createdAt,
        lastActivityAt: projects.lastActivityAt,
        deletedAt: projects.deletedAt,
        completed: projects.completed,
        unitCount: projects.unitCount,
        unitLabels: projects.unitLabels,
        photoCount: sql<number>`CAST(COUNT(CASE WHEN ${photos.deletedAt} IS NULL THEN ${photos.id} END) AS INTEGER)`,
        coverPhoto: {
          id: coverPhoto.id,
          url: coverPhoto.url,
          caption: coverPhoto.caption,
          mediaType: coverPhoto.mediaType,
          projectId: coverPhoto.projectId,
          photographerId: coverPhoto.photographerId,
          photographerName: coverPhoto.photographerName,
          createdAt: coverPhoto.createdAt,
          deletedAt: coverPhoto.deletedAt,
        },
      })
      .from(projects)
      .leftJoin(photos, eq(photos.projectId, projects.id))
      .leftJoin(coverPhoto, eq(coverPhoto.id, projects.coverPhotoId))
      .where(and(eq(projects.companyId, companyId), isNull(projects.deletedAt)))
      .groupBy(projects.id, projects.unitCount, projects.unitLabels, coverPhoto.id, coverPhoto.url, coverPhoto.caption, coverPhoto.mediaType, coverPhoto.projectId, coverPhoto.photographerId, coverPhoto.photographerName, coverPhoto.createdAt, coverPhoto.deletedAt)
      .orderBy(projects.createdAt);
    
    // Map to clean up undefined cover photos
    return result.map(r => ({
      ...r,
      coverPhoto: r.coverPhoto?.id ? r.coverPhoto as Photo : undefined,
    }));
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

  async toggleProjectCompletion(id: string): Promise<Project | undefined> {
    // Get current completion status
    const project = await this.getProject(id);
    if (!project) return undefined;
    
    // Toggle completion status
    const result = await db.update(projects)
      .set({ completed: !project.completed })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async trackProjectVisit(userId: string, projectId: string): Promise<ProjectVisit> {
    const result = await db.insert(projectVisits)
      .values({ userId, projectId })
      .returning();
    return result[0];
  }

  async toggleProjectFavorite(userId: string, projectId: string, isFavorite: boolean): Promise<ProjectFavorite | boolean> {
    if (isFavorite) {
      // Add favorite - use onConflictDoNothing to handle duplicate favorites
      const result = await db.insert(projectFavorites)
        .values({ userId, projectId })
        .onConflictDoNothing()
        .returning();
      return result[0] || false; // Return false if already existed
    } else {
      // Remove favorite
      await db.delete(projectFavorites)
        .where(and(
          eq(projectFavorites.userId, userId),
          eq(projectFavorites.projectId, projectId)
        ));
      return false;
    }
  }

  async getUserFavoriteProjectIds(userId: string): Promise<string[]> {
    const favorites = await db.select({ projectId: projectFavorites.projectId })
      .from(projectFavorites)
      .where(eq(projectFavorites.userId, userId));
    return favorites.map(f => f.projectId);
  }

  async getUserRecentProjectIds(userId: string, limit: number = 10): Promise<string[]> {
    const visits = await db
      .selectDistinctOn([projectVisits.projectId], { projectId: projectVisits.projectId })
      .from(projectVisits)
      .where(eq(projectVisits.userId, userId))
      .orderBy(projectVisits.projectId, desc(projectVisits.visitedAt))
      .limit(limit);
    return visits.map(v => v.projectId);
  }

  // Photos
  async getProjectPhotos(projectId: string, options?: { limit?: number; cursor?: string }): Promise<{ photos: Photo[]; nextCursor?: string }> {
    const shouldPaginate = options?.limit !== undefined;
    const limit = options?.limit ?? 50; // Only used when pagination is requested
    const cursor = options?.cursor;
    
    // Build query conditions
    const conditions = [
      eq(photos.projectId, projectId),
      isNull(photos.deletedAt)
    ];
    
    // Add cursor condition if provided (fetch photos created after cursor timestamp)
    if (cursor) {
      conditions.push(sql`${photos.createdAt} > ${cursor}`);
    }
    
    // Build query
    let query = db.select().from(photos)
      .where(and(...conditions))
      .orderBy(photos.createdAt);
    
    // Only apply limit if pagination is explicitly requested
    if (shouldPaginate) {
      query = query.limit(limit + 1); // Fetch limit + 1 to check if there's a next page
    }
    
    const photoList = await query;
    
    // Check if there are more photos (only relevant when paginating)
    const hasMore = shouldPaginate && photoList.length > limit;
    const photosToReturn = hasMore ? photoList.slice(0, limit) : photoList;
    
    // If there are no photos, return empty result
    if (photosToReturn.length === 0) {
      return { photos: [], nextCursor: undefined };
    }
    
    // Get all tags for these photos in one query (ordered by name for stability)
    const photoIds = photosToReturn.map(p => p.id);
    const photoTagsWithTags = await db.select({
      photoId: photoTags.photoId,
      tag: tags,
    })
      .from(photoTags)
      .innerJoin(tags, eq(photoTags.tagId, tags.id))
      .where(inArray(photoTags.photoId, photoIds))
      .orderBy(tags.name);
    
    // Group tags by photoId
    const tagsByPhotoId = new Map<string, Tag[]>();
    for (const pt of photoTagsWithTags) {
      if (!tagsByPhotoId.has(pt.photoId)) {
        tagsByPhotoId.set(pt.photoId, []);
      }
      tagsByPhotoId.get(pt.photoId)!.push(pt.tag);
    }
    
    // Attach tags to photos
    const photosWithTags = photosToReturn.map(photo => ({
      ...photo,
      tags: tagsByPhotoId.get(photo.id) || [],
    })) as any;
    
    // Generate next cursor from last photo's createdAt timestamp
    const nextCursor = hasMore ? photosToReturn[photosToReturn.length - 1].createdAt.toISOString() : undefined;
    
    return { photos: photosWithTags, nextCursor };
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
  async getPhotoAnnotation(id: string): Promise<PhotoAnnotation | undefined> {
    const result = await db.select().from(photoAnnotations).where(eq(photoAnnotations.id, id));
    return result[0];
  }

  async getPhotoAnnotations(photoId: string): Promise<(PhotoAnnotation & { user?: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]> {
    const result = await db
      .select({
        id: photoAnnotations.id,
        photoId: photoAnnotations.photoId,
        userId: photoAnnotations.userId,
        type: photoAnnotations.type,
        content: photoAnnotations.content,
        color: photoAnnotations.color,
        strokeWidth: photoAnnotations.strokeWidth,
        fontSize: photoAnnotations.fontSize,
        position: photoAnnotations.position,
        createdAt: photoAnnotations.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(photoAnnotations)
      .leftJoin(users, eq(photoAnnotations.userId, users.id))
      .where(eq(photoAnnotations.photoId, photoId))
      .orderBy(photoAnnotations.createdAt);
    
    return result as any;
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
  async getPhotoComments(photoId: string): Promise<(Comment & { user?: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]> {
    const result = await db
      .select({
        id: comments.id,
        photoId: comments.photoId,
        userId: comments.userId,
        content: comments.content,
        mentions: comments.mentions,
        createdAt: comments.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.photoId, photoId))
      .orderBy(comments.createdAt);
    
    return result as any;
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

  async getShareByProjectId(projectId: string): Promise<Share | undefined> {
    const result = await db.select().from(shares).where(eq(shares.projectId, projectId));
    return result[0];
  }

  async deleteShare(id: string): Promise<boolean> {
    const result = await db.delete(shares).where(eq(shares.id, id)).returning();
    return result.length > 0;
  }

  // Share View Logs
  async createShareViewLog(data: InsertShareViewLog): Promise<ShareViewLog> {
    const result = await db.insert(shareViewLogs).values(data).returning();
    return result[0];
  }

  async getShareViewLogs(shareId: string): Promise<ShareViewLog[]> {
    return await db.select().from(shareViewLogs)
      .where(eq(shareViewLogs.shareId, shareId))
      .orderBy(shareViewLogs.viewedAt);
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
    // Get the photo to retrieve its URL before deleting (including soft-deleted items)
    const photoResult = await db.select().from(photos).where(eq(photos.id, id));
    const photo = photoResult[0];
    
    // Delete from database
    const result = await db.delete(photos).where(eq(photos.id, id)).returning();
    
    // Clean up object storage if the photo was stored there
    if (photo?.url && result.length > 0) {
      await this.objectStorageService.deleteObjectEntity(photo.url);
    }
    
    return result.length > 0;
  }

  async permanentlyDeleteAllTrash(): Promise<{ projectsDeleted: number; photosDeleted: number }> {
    // Get all soft-deleted photos for cleanup
    const photosToDelete = await db.select()
      .from(photos)
      .where(isNotNull(photos.deletedAt));

    // Delete all soft-deleted projects
    const deletedProjects = await db.delete(projects)
      .where(isNotNull(projects.deletedAt))
      .returning();
    
    // Delete all soft-deleted photos
    const deletedPhotos = await db.delete(photos)
      .where(isNotNull(photos.deletedAt))
      .returning();
    
    // Clean up object storage for deleted photos
    for (const photo of photosToDelete) {
      if (photo.url) {
        await this.objectStorageService.deleteObjectEntity(photo.url);
      }
    }
    
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

    // Get photos older than 30 days for cleanup
    const oldPhotos = await db.select()
      .from(photos)
      .where(and(
        isNotNull(photos.deletedAt),
        lt(photos.deletedAt, thirtyDaysAgo)
      ));

    // Delete photos from database
    await db.delete(photos)
      .where(and(
        isNotNull(photos.deletedAt),
        lt(photos.deletedAt, thirtyDaysAgo)
      ));

    // Clean up object storage for deleted photos
    for (const photo of oldPhotos) {
      if (photo.url) {
        await this.objectStorageService.deleteObjectEntity(photo.url);
      }
    }
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

  async updateTag(id: string, data: Partial<InsertTag>): Promise<Tag | undefined> {
    const result = await db.update(tags)
      .set(data)
      .where(eq(tags.id, id))
      .returning();
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

  // PDFs
  async getPdf(id: string): Promise<Pdf | undefined> {
    const result = await db.select().from(pdfs).where(eq(pdfs.id, id));
    return result[0];
  }

  async getProjectPdfs(projectId: string): Promise<Pdf[]> {
    return await db.select().from(pdfs)
      .where(eq(pdfs.projectId, projectId))
      .orderBy(pdfs.createdAt.desc());
  }

  async createPdf(data: InsertPdf): Promise<Pdf> {
    const result = await db.insert(pdfs).values(data).returning();
    return result[0];
  }

  async deletePdf(id: string): Promise<boolean> {
    const result = await db.delete(pdfs).where(eq(pdfs.id, id)).returning();
    return result.length > 0;
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async getProjectTasks(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(tasks.createdAt);
  }

  async getTasksAssignedToUser(userId: string): Promise<(Task & { project: { id: string; name: string } })[]> {
    const result = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        taskName: tasks.taskName,
        assignedTo: tasks.assignedTo,
        createdBy: tasks.createdBy,
        completed: tasks.completed,
        completedAt: tasks.completedAt,
        completedBy: tasks.completedBy,
        createdAt: tasks.createdAt,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.assignedTo, userId),
        isNull(projects.deletedAt) // Only tasks from active projects
      ))
      .orderBy(tasks.createdAt);
    
    return result as any;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(data).returning();
    return result[0];
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set(data)
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async completeTask(id: string, userId: string): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set({ 
        completed: true, 
        completedAt: new Date(),
        completedBy: userId 
      })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async restoreTask(id: string): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set({ 
        completed: false, 
        completedAt: null,
        completedBy: null 
      })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  // ToDos
  async getTodo(id: string): Promise<ToDo | undefined> {
    const result = await db.select().from(todos).where(eq(todos.id, id));
    return result[0];
  }

  async getTodos(companyId: string, userId: string, filters?: { projectId?: string; completed?: boolean; flag?: boolean; dueToday?: boolean; view?: 'my-tasks' | 'team-tasks' | 'i-created' | 'flagged' }): Promise<(ToDo & { project?: { id: string; name: string }; photo?: { id: string; url: string }; assignee: { id: string; firstName: string | null; lastName: string | null }; creator: { id: string; firstName: string | null; lastName: string | null } })[]> {
    let query = db
      .select({
        id: todos.id,
        title: todos.title,
        description: todos.description,
        projectId: todos.projectId,
        photoId: todos.photoId,
        assignedTo: todos.assignedTo,
        createdBy: todos.createdBy,
        completed: todos.completed,
        completedAt: todos.completedAt,
        completedBy: todos.completedBy,
        dueDate: todos.dueDate,
        flag: todos.flag,
        createdAt: todos.createdAt,
        project: {
          id: projects.id,
          name: projects.name,
        },
        photo: {
          id: photos.id,
          url: photos.url,
        },
        assignee: {
          id: sql<string>`assignee.id`,
          firstName: sql<string | null>`assignee.first_name`,
          lastName: sql<string | null>`assignee.last_name`,
        },
        creator: {
          id: sql<string>`creator.id`,
          firstName: sql<string | null>`creator.first_name`,
          lastName: sql<string | null>`creator.last_name`,
        },
      })
      .from(todos)
      .leftJoin(projects, eq(todos.projectId, projects.id))
      .leftJoin(photos, eq(todos.photoId, photos.id))
      .innerJoin(sql`users AS assignee`, sql`${todos.assignedTo} = assignee.id`)
      .innerJoin(sql`users AS creator`, sql`${todos.createdBy} = creator.id`)
      .$dynamic();

    // Filter by view
    if (filters?.view === 'my-tasks') {
      query = query.where(eq(todos.assignedTo, userId));
    } else if (filters?.view === 'i-created') {
      query = query.where(eq(todos.createdBy, userId));
    } else if (filters?.view === 'flagged') {
      query = query.where(eq(todos.flag, true));
    }
    // team-tasks shows all (no additional filter needed, company filter happens via user check)

    // Filter by project if provided
    if (filters?.projectId) {
      query = query.where(eq(todos.projectId, filters.projectId));
    }

    // Filter by completion status if provided
    if (filters?.completed !== undefined) {
      query = query.where(eq(todos.completed, filters.completed));
    }

    // Filter by flag if provided
    if (filters?.flag !== undefined) {
      query = query.where(eq(todos.flag, filters.flag));
    }

    // Filter by dueToday if provided
    if (filters?.dueToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      query = query.where(
        and(
          sql`${todos.dueDate} >= ${today.toISOString()}`,
          sql`${todos.dueDate} < ${tomorrow.toISOString()}`
        )
      );
    }

    const result = await query.orderBy(todos.createdAt);
    return result as any;
  }

  async createTodo(data: InsertToDo): Promise<ToDo> {
    const result = await db.insert(todos).values(data).returning();
    return result[0];
  }

  async createTodosBatch(userId: string, data: BatchTodoInput): Promise<ToDo[]> {
    // Enforce batch size limit
    const MAX_BATCH_SIZE = 50;
    if (data.todos.length === 0) {
      throw new Error('Batch must contain at least one todo');
    }
    if (data.todos.length > MAX_BATCH_SIZE) {
      throw new Error(`Batch size cannot exceed ${MAX_BATCH_SIZE} todos`);
    }

    // Require projectId for proper validation
    if (!data.projectId) {
      throw new Error('Project ID is required for batch todo creation');
    }

    // Get user's company for validation
    const user = await this.getUser(userId);
    if (!user || !user.companyId) {
      throw new Error('User must belong to a company to create todos');
    }

    // Validate project ownership
    const project = await this.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    if (project.companyId !== user.companyId) {
      throw new Error('Project does not belong to your company');
    }

    // Collect all photoIds and assigneeIds for validation
    const photoIds = data.todos.map(t => t.photoId).filter(Boolean);
    const assigneeIds = data.todos.map(t => t.assignedTo).filter(Boolean) as string[];

    // Validate all photos belong to the exact project
    if (photoIds.length > 0) {
      const photosResult = await db
        .select({ id: photos.id, projectId: photos.projectId })
        .from(photos)
        .where(inArray(photos.id, photoIds));

      if (photosResult.length !== photoIds.length) {
        throw new Error('One or more photos not found');
      }

      // Ensure ALL photos belong to the target project
      for (const photo of photosResult) {
        if (photo.projectId !== data.projectId) {
          throw new Error('All photos must belong to the target project');
        }
      }
    }

    // Validate all assignees belong to the same company and are not removed
    if (assigneeIds.length > 0) {
      const assigneesResult = await db
        .select({ id: users.id, companyId: users.companyId, removedAt: users.removedAt })
        .from(users)
        .where(inArray(users.id, assigneeIds));

      if (assigneesResult.length !== assigneeIds.length) {
        throw new Error('One or more assignees not found');
      }

      for (const assignee of assigneesResult) {
        if (assignee.companyId !== user.companyId) {
          throw new Error('One or more assignees do not belong to your company');
        }
        if (assignee.removedAt) {
          throw new Error('One or more assignees have been removed from the company');
        }
      }
    }

    // Use transaction to ensure data consistency
    return await db.transaction(async (tx) => {
      // Transform batch input into insertable todos
      const todosToInsert: InsertToDo[] = data.todos.map(todo => ({
        title: todo.title,
        description: todo.description || null,
        projectId: data.projectId!,
        photoId: todo.photoId,
        assignedTo: todo.assignedTo || null,
        createdBy: userId,
        dueDate: todo.dueDate || null,
        flag: todo.flag || false,
        completed: false,
      }));

      // Insert all todos atomically
      const result = await tx.insert(todos).values(todosToInsert).returning();

      // Create activity logs within same transaction
      if (result.length > 0) {
        const activityLogsToInsert = result.map(todo => ({
          userId,
          companyId: user.companyId!,
          action: 'todo_created' as const,
          entityType: 'todo' as const,
          entityId: todo.id,
          metadata: {
            todoTitle: todo.title,
            projectId: todo.projectId,
            assignedTo: todo.assignedTo,
            batchSize: result.length,
          },
        }));

        await tx.insert(activityLogs).values(activityLogsToInsert);
      }

      return result;
    });
  }

  async updateTodo(id: string, data: Partial<InsertToDo>): Promise<ToDo | undefined> {
    const result = await db.update(todos)
      .set(data)
      .where(eq(todos.id, id))
      .returning();
    return result[0];
  }

  async completeTodo(id: string, userId: string): Promise<ToDo | undefined> {
    const result = await db.update(todos)
      .set({ 
        completed: true, 
        completedAt: new Date(),
        completedBy: userId 
      })
      .where(eq(todos.id, id))
      .returning();
    return result[0];
  }

  async toggleTodoFlag(id: string): Promise<ToDo | undefined> {
    const todo = await this.getTodo(id);
    if (!todo) return undefined;
    
    const result = await db.update(todos)
      .set({ flag: !todo.flag })
      .where(eq(todos.id, id))
      .returning();
    return result[0];
  }

  async deleteTodo(id: string): Promise<boolean> {
    const result = await db.delete(todos).where(eq(todos.id, id)).returning();
    return result.length > 0;
  }

  // Billing & Subscriptions
  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return result[0];
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserSubscriptionStatus(userId: string, status: string, trialEndDate?: Date): Promise<User | undefined> {
    const updates: any = { subscriptionStatus: status };
    if (trialEndDate) {
      updates.trialEndDate = trialEndDate;
    }
    
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async startUserTrial(userId: string): Promise<User | undefined> {
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days from now
    
    const result = await db.update(users)
      .set({
        trialStartDate,
        trialEndDate,
        subscriptionStatus: 'trial',
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(data).returning();
    return result[0];
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const result = await db.update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return result[0];
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return result[0];
  }

  async getSubscriptionByCompanyId(companyId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
    return result[0];
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return result[0];
  }

  async createSubscriptionEvent(data: InsertSubscriptionEvent): Promise<SubscriptionEvent> {
    const result = await db.insert(subscriptionEvents).values(data).returning();
    return result[0];
  }

  async getSubscriptionEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
    return await db.select().from(subscriptionEvents)
      .where(eq(subscriptionEvents.subscriptionId, subscriptionId))
      .orderBy(subscriptionEvents.createdAt);
  }

  // PKCE OAuth Storage (in-memory)
  async storePKCEVerifier(state: string, verifier: string, expiresInMs: number = 600000): Promise<void> {
    // Default 10 minute expiration
    const expiresAt = Date.now() + expiresInMs;
    this.pkceStore.set(state, { verifier, expiresAt });
    
    // Cleanup expired entries when storing new ones
    this.cleanupExpiredPKCE();
  }

  async getPKCEVerifier(state: string): Promise<string | undefined> {
    const entry = this.pkceStore.get(state);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.pkceStore.delete(state);
      return undefined;
    }
    
    return entry.verifier;
  }

  async deletePKCEVerifier(state: string): Promise<void> {
    this.pkceStore.delete(state);
  }

  async cleanupExpiredPKCE(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.pkceStore.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.pkceStore.delete(key);
    }
  }

  // Seed predefined trade tags
  async seedPredefinedTags(): Promise<void> {
    const predefinedTags = [
      { name: 'Electrician', color: 'red' },
      { name: 'HVAC', color: 'yellow' },
      { name: 'Plumber', color: 'blue' },
      { name: 'Framer', color: 'orange' },
    ];

    // Batch check: get all existing global tags in one query
    const tagNames = predefinedTags.map(t => t.name);
    const existingTags = await db.select().from(tags)
      .where(and(inArray(tags.name, tagNames), isNull(tags.projectId)));
    
    // Create set of existing tag names for O(1) lookup
    const existingNames = new Set(existingTags.map(t => t.name));
    
    // Insert only missing tags in batch
    const tagsToInsert = predefinedTags
      .filter(tag => !existingNames.has(tag.name))
      .map(tag => ({
        name: tag.name,
        color: tag.color,
        projectId: null, // Global tag
      }));
    
    if (tagsToInsert.length > 0) {
      await db.insert(tags).values(tagsToInsert);
    }
  }

  // Waitlist operations
  async addToWaitlist(data: InsertWaitlist): Promise<Waitlist> {
    const result = await db.insert(waitlist)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return result[0];
  }

  async getWaitlistEntries(): Promise<Waitlist[]> {
    return await db.select().from(waitlist);
  }

  // Activity logs operations
  async createActivityLog(data: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs)
      .values(data)
      .returning();
    return result[0];
  }

  async getActivityLogs(
    companyId: string,
    options?: { limit?: number; userId?: string; action?: string; entityType?: string }
  ): Promise<(ActivityLog & { user: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]> {
    const limit = options?.limit || 50;
    
    // Build where conditions
    const conditions = [eq(activityLogs.companyId, companyId)];
    if (options?.userId) {
      conditions.push(eq(activityLogs.userId, options.userId));
    }
    if (options?.action) {
      conditions.push(eq(activityLogs.action, options.action));
    }
    if (options?.entityType) {
      conditions.push(eq(activityLogs.entityType, options.entityType));
    }

    const result = await db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        companyId: activityLogs.companyId,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(activityLogs)
      .innerJoin(users, eq(activityLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(sql`${activityLogs.createdAt} DESC`)
      .limit(limit);

    return result;
  }

  // Notifications operations
  async createNotification(data: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications)
      .values(data)
      .returning();
    return result[0];
  }

  async getNotifications(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<Notification[]> {
    const limit = options?.limit || 50;
    const conditions = [eq(notifications.userId, userId)];
    
    if (options?.unreadOnly) {
      conditions.push(eq(notifications.read, false));
    }

    return await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(sql`${notifications.createdAt} DESC`)
      .limit(limit);
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
    return result[0]?.count || 0;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.id, id))
      .returning();
    return result.length > 0;
  }

  // Clock Entries (time tracking)
  
  // Helper function to validate clock entry state transitions
  private async validateClockEntryState(
    userId: string,
    timestamp: Date,
    entryType: string,
    excludeId?: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Get day boundaries for the timestamp
    const day = new Date(timestamp);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Fetch all entries for the day (excluding the one being edited if applicable)
    const conditions = [
      eq(clockEntries.userId, userId),
      sql`${clockEntries.timestamp} >= ${day}`,
      sql`${clockEntries.timestamp} < ${nextDay}`
    ];
    
    if (excludeId) {
      conditions.push(sql`${clockEntries.id} != ${excludeId}`);
    }
    
    const existingEntries = await db
      .select()
      .from(clockEntries)
      .where(and(...conditions))
      .orderBy(clockEntries.timestamp);
    
    // Find entries immediately before and after the new timestamp
    const entriesBefore = existingEntries.filter(e => e.timestamp < timestamp);
    const entriesAfter = existingEntries.filter(e => e.timestamp > timestamp);
    
    // Determine current state right before this entry
    let stateBefore = { isClockedIn: false, onBreak: false };
    for (const entry of entriesBefore) {
      if (entry.type === 'clock_in') {
        stateBefore = { isClockedIn: true, onBreak: false };
      } else if (entry.type === 'clock_out') {
        stateBefore = { isClockedIn: false, onBreak: false };
      } else if (entry.type === 'break_start') {
        stateBefore.onBreak = true;
      } else if (entry.type === 'break_end') {
        stateBefore.onBreak = false;
      }
    }
    
    // Validate the specific action being attempted
    if (entryType === 'clock_in' && stateBefore.isClockedIn) {
      return {
        valid: false,
        error: 'Cannot clock in at this time - already clocked in. Clock out first.'
      };
    }
    
    if (entryType === 'clock_out' && !stateBefore.isClockedIn) {
      return {
        valid: false,
        error: 'Cannot clock out at this time - not clocked in.'
      };
    }
    
    if (entryType === 'break_start') {
      if (!stateBefore.isClockedIn) {
        return { valid: false, error: 'Cannot start break - not clocked in.' };
      }
      if (stateBefore.onBreak) {
        return { valid: false, error: 'Cannot start break - already on break.' };
      }
    }
    
    if (entryType === 'break_end' && !stateBefore.onBreak) {
      return {
        valid: false,
        error: 'Cannot end break at this time - not on break.'
      };
    }
    
    // Determine state after this entry
    let stateAfter = { ...stateBefore };
    if (entryType === 'clock_in') {
      stateAfter = { isClockedIn: true, onBreak: false };
    } else if (entryType === 'clock_out') {
      stateAfter = { isClockedIn: false, onBreak: false };
    } else if (entryType === 'break_start') {
      stateAfter.onBreak = true;
    } else if (entryType === 'break_end') {
      stateAfter.onBreak = false;
    }
    
    // Validate the first entry after this one is compatible with the new state
    if (entriesAfter.length > 0) {
      const nextEntry = entriesAfter[0];
      
      if (nextEntry.type === 'clock_in' && stateAfter.isClockedIn) {
        return {
          valid: false,
          error: 'This timestamp would create an invalid sequence - next entry is clock-in but state would be clocked-in.'
        };
      }
      
      if (nextEntry.type === 'clock_out' && !stateAfter.isClockedIn) {
        return {
          valid: false,
          error: 'This timestamp would create an invalid sequence - next entry is clock-out but state would be clocked-out.'
        };
      }
    }
    
    return { valid: true };
  }
  
  async createClockEntry(data: InsertClockEntry): Promise<ClockEntry> {
    // Validate the state transition
    const validation = await this.validateClockEntryState(
      data.userId,
      data.timestamp,
      data.type
    );
    
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const result = await db
      .insert(clockEntries)
      .values(data)
      .returning();
    return result[0];
  }

  async getClockEntries(companyId: string, options?: { userId?: string; startDate?: Date; endDate?: Date }): Promise<(ClockEntry & { user: { id: string; firstName: string | null; lastName: string | null; email: string | null } })[]> {
    const conditions = [eq(clockEntries.companyId, companyId)];
    
    if (options?.userId) {
      conditions.push(eq(clockEntries.userId, options.userId));
    }
    
    if (options?.startDate) {
      conditions.push(sql`${clockEntries.timestamp} >= ${options.startDate}`);
    }
    
    if (options?.endDate) {
      conditions.push(sql`${clockEntries.timestamp} <= ${options.endDate}`);
    }
    
    const result = await db
      .select({
        id: clockEntries.id,
        userId: clockEntries.userId,
        companyId: clockEntries.companyId,
        type: clockEntries.type,
        timestamp: clockEntries.timestamp,
        location: clockEntries.location,
        notes: clockEntries.notes,
        editedBy: clockEntries.editedBy,
        editReason: clockEntries.editReason,
        originalTimestamp: clockEntries.originalTimestamp,
        createdAt: clockEntries.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(clockEntries)
      .leftJoin(users, eq(clockEntries.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(clockEntries.timestamp));
    
    return result;
  }

  async getTodayClockStatus(userId: string): Promise<{ isClockedIn: boolean; onBreak: boolean; clockInTime?: Date; totalHoursToday: number; currentProjectId?: string | null }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const entries = await db
      .select()
      .from(clockEntries)
      .where(and(
        eq(clockEntries.userId, userId),
        sql`${clockEntries.timestamp} >= ${today}`,
        sql`${clockEntries.timestamp} < ${tomorrow}`
      ))
      .orderBy(clockEntries.timestamp); // Order by actual event time (not creation time) to support retroactive/backfill edits
    
    let isClockedIn = false;
    let onBreak = false;
    let clockInTime: Date | undefined;
    let currentProjectId: string | null = null;
    let totalMs = 0;
    let lastClockIn: Date | null = null;
    let lastBreakStart: Date | null = null;
    
    for (const entry of entries) {
      if (entry.type === 'clock_in') {
        isClockedIn = true;
        lastClockIn = entry.timestamp;
        clockInTime = entry.timestamp;
        currentProjectId = entry.projectId;
      } else if (entry.type === 'clock_out') {
        if (lastClockIn) {
          totalMs += entry.timestamp.getTime() - lastClockIn.getTime();
          lastClockIn = null;
        }
        isClockedIn = false;
        onBreak = false;
        currentProjectId = null;
      } else if (entry.type === 'break_start') {
        if (lastClockIn) {
          totalMs += entry.timestamp.getTime() - lastClockIn.getTime();
        }
        onBreak = true;
        lastBreakStart = entry.timestamp;
        lastClockIn = null;
      } else if (entry.type === 'break_end') {
        onBreak = false;
        lastClockIn = entry.timestamp;
        lastBreakStart = null;
      }
    }
    
    // If still clocked in, add time up to now
    if (lastClockIn && isClockedIn && !onBreak) {
      totalMs += Date.now() - lastClockIn.getTime();
    }
    
    const totalHoursToday = totalMs / (1000 * 60 * 60);
    
    return {
      isClockedIn,
      onBreak,
      clockInTime,
      totalHoursToday,
      currentProjectId,
    };
  }

  async getClockEntriesForUser(userId: string, startDate: Date, endDate: Date): Promise<ClockEntry[]> {
    // Expand range by 24 hours on each side to capture overnight shifts/breaks
    const expandedStart = new Date(startDate);
    expandedStart.setHours(expandedStart.getHours() - 24);
    
    const expandedEnd = new Date(endDate);
    expandedEnd.setHours(expandedEnd.getHours() + 24);
    
    const entries = await db
      .select()
      .from(clockEntries)
      .where(and(
        eq(clockEntries.userId, userId),
        sql`${clockEntries.timestamp} >= ${expandedStart}`,
        sql`${clockEntries.timestamp} <= ${expandedEnd}`
      ))
      .orderBy(clockEntries.timestamp);
    
    return entries;
  }

  async updateClockEntry(id: string, data: { timestamp: Date; editedBy: string; editReason: string; originalTimestamp: Date }): Promise<ClockEntry | undefined> {
    // Get the existing entry to know its type and userId
    const existing = await db
      .select()
      .from(clockEntries)
      .where(eq(clockEntries.id, id))
      .limit(1);
    
    if (!existing || existing.length === 0) {
      throw new Error('Clock entry not found');
    }
    
    const entry = existing[0];
    
    // Validate the new timestamp doesn't create invalid state
    const validation = await this.validateClockEntryState(
      entry.userId,
      data.timestamp,
      entry.type,
      id // Exclude this entry from validation check
    );
    
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const result = await db
      .update(clockEntries)
      .set({
        timestamp: data.timestamp,
        editedBy: data.editedBy,
        editReason: data.editReason,
        originalTimestamp: data.originalTimestamp,
      })
      .where(eq(clockEntries.id, id))
      .returning();
    return result[0];
  }

  async switchProject(userId: string, companyId: string, newProjectId: string, location?: string, notes?: string): Promise<{ clockOutEntry: ClockEntry; clockInEntry: ClockEntry }> {
    // Use database transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get current clock status to verify user is clocked in
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const entries = await tx
        .select()
        .from(clockEntries)
        .where(and(
          eq(clockEntries.userId, userId),
          sql`${clockEntries.timestamp} >= ${today}`,
          sql`${clockEntries.timestamp} < ${tomorrow}`
        ))
        .orderBy(clockEntries.timestamp);
      
      // Calculate status from entries
      let isClockedIn = false;
      let currentProjectId: string | null = null;
      
      for (const entry of entries) {
        if (entry.type === 'clock_in') {
          isClockedIn = true;
          currentProjectId = entry.projectId;
        } else if (entry.type === 'clock_out') {
          isClockedIn = false;
          currentProjectId = null;
        }
      }
      
      if (!isClockedIn) {
        throw new Error("Cannot switch project - not currently clocked in");
      }
      
      if (currentProjectId === newProjectId) {
        throw new Error("Cannot switch to the same project");
      }
      
      // Create atomic timestamp for both entries
      const switchTimestamp = new Date();
      
      // Create clock_out entry for old project
      const clockOutResult = await tx
        .insert(clockEntries)
        .values({
          userId,
          companyId,
          projectId: currentProjectId,
          type: 'clock_out',
          timestamp: switchTimestamp,
          location,
          notes: notes ? `Project switch: ${notes}` : 'Project switch',
        })
        .returning();
      
      // Create clock_in entry for new project
      const clockInResult = await tx
        .insert(clockEntries)
        .values({
          userId,
          companyId,
          projectId: newProjectId,
          type: 'clock_in',
          timestamp: switchTimestamp,
          location,
          notes: notes ? `Project switch: ${notes}` : 'Project switch',
        })
        .returning();
      
      return {
        clockOutEntry: clockOutResult[0],
        clockInEntry: clockInResult[0],
      };
    });
  }

  // Geofences (automatic time tracking boundaries)
  
  async createGeofence(data: InsertGeofence): Promise<Geofence> {
    const result = await db
      .insert(geofences)
      .values(data)
      .returning();
    return result[0];
  }

  async getGeofence(id: string): Promise<Geofence | undefined> {
    const result = await db
      .select()
      .from(geofences)
      .where(eq(geofences.id, id));
    return result[0];
  }

  async getGeofencesByCompany(companyId: string): Promise<Geofence[]> {
    return await db
      .select()
      .from(geofences)
      .where(eq(geofences.companyId, companyId))
      .orderBy(geofences.createdAt);
  }

  async getGeofencesByProject(projectId: string): Promise<Geofence[]> {
    return await db
      .select()
      .from(geofences)
      .where(eq(geofences.projectId, projectId));
  }

  async updateGeofence(id: string, data: Partial<InsertGeofence>): Promise<Geofence | undefined> {
    const result = await db
      .update(geofences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(geofences.id, id))
      .returning();
    return result[0];
  }

  async deleteGeofence(id: string): Promise<boolean> {
    const result = await db
      .delete(geofences)
      .where(eq(geofences.id, id))
      .returning();
    return result.length > 0;
  }

  // Location Logs (5-minute location pings when clocked in)
  
  async createLocationLog(data: InsertLocationLog): Promise<LocationLog> {
    const result = await db
      .insert(locationLogs)
      .values(data)
      .returning();
    return result[0];
  }

  async getLocationLogs(userId: string, options?: { startDate?: Date; endDate?: Date }): Promise<LocationLog[]> {
    const conditions = [eq(locationLogs.userId, userId)];
    
    if (options?.startDate) {
      conditions.push(sql`${locationLogs.timestamp} >= ${options.startDate}`);
    }
    
    if (options?.endDate) {
      conditions.push(sql`${locationLogs.timestamp} <= ${options.endDate}`);
    }
    
    return await db
      .select()
      .from(locationLogs)
      .where(and(...conditions))
      .orderBy(desc(locationLogs.timestamp));
  }

  async getRecentLocationLogs(companyId: string, minutes: number = 5): Promise<(LocationLog & { user: { id: string; firstName: string | null; lastName: string | null }; project?: { id: string; name: string } | null })[]> {
    // Calculate cutoff time (e.g., last 5 minutes)
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);
    
    // Join locationLogs with users and projects to get full context
    const logs = await db
      .select({
        // Location log fields
        id: locationLogs.id,
        userId: locationLogs.userId,
        projectId: locationLogs.projectId,
        latitude: locationLogs.latitude,
        longitude: locationLogs.longitude,
        accuracy: locationLogs.accuracy,
        batteryLevel: locationLogs.batteryLevel,
        isMoving: locationLogs.isMoving,
        timestamp: locationLogs.timestamp,
        // User fields
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        // Project fields (nullable)
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(locationLogs)
      .innerJoin(users, eq(locationLogs.userId, users.id))
      .leftJoin(projects, eq(locationLogs.projectId, projects.id))
      .where(and(
        eq(users.companyId, companyId),
        sql`${locationLogs.timestamp} >= ${cutoffTime}`
      ))
      .orderBy(desc(locationLogs.timestamp));
    
    // Transform the result to match the expected shape
    return logs.map(log => ({
      id: log.id,
      userId: log.userId,
      projectId: log.projectId,
      latitude: log.latitude,
      longitude: log.longitude,
      accuracy: log.accuracy,
      batteryLevel: log.batteryLevel,
      isMoving: log.isMoving,
      timestamp: log.timestamp,
      user: log.user,
      project: log.project.id ? log.project : null,
    }));
  }

  // User Permissions (role-based access control)
  
  async createUserPermission(data: InsertUserPermission): Promise<UserPermission> {
    const result = await db
      .insert(userPermissions)
      .values(data)
      .returning();
    return result[0];
  }

  async getUserPermission(userId: string): Promise<UserPermission | undefined> {
    const result = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    return result[0];
  }

  async updateUserPermission(userId: string, data: Partial<InsertUserPermission>): Promise<UserPermission | undefined> {
    const result = await db
      .update(userPermissions)
      .set(data)
      .where(eq(userPermissions.userId, userId))
      .returning();
    return result[0];
  }

  async deleteUserPermission(userId: string): Promise<boolean> {
    const result = await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .returning();
    return result.length > 0;
  }

  // Time Entry Edits (audit trail for time modifications)
  
  async createTimeEntryEdit(data: InsertTimeEntryEdit): Promise<TimeEntryEdit> {
    const result = await db
      .insert(timeEntryEdits)
      .values(data)
      .returning();
    return result[0];
  }

  async getTimeEntryEdits(clockEntryId: string): Promise<(TimeEntryEdit & { editor: { id: string; firstName: string | null; lastName: string | null } })[]> {
    const edits = await db
      .select({
        // Time entry edit fields
        id: timeEntryEdits.id,
        clockEntryId: timeEntryEdits.clockEntryId,
        editedBy: timeEntryEdits.editedBy,
        fieldChanged: timeEntryEdits.fieldChanged,
        oldValue: timeEntryEdits.oldValue,
        newValue: timeEntryEdits.newValue,
        reason: timeEntryEdits.reason,
        timestamp: timeEntryEdits.timestamp,
        // Editor user fields
        editor: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(timeEntryEdits)
      .innerJoin(users, eq(timeEntryEdits.editedBy, users.id))
      .where(eq(timeEntryEdits.clockEntryId, clockEntryId))
      .orderBy(desc(timeEntryEdits.timestamp));
    
    return edits;
  }
}

export const storage = new DbStorage();
