import { pgTable, varchar, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table (for authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WebAuthn credentials table (for biometric authentication)
export const credentials = pgTable("credentials", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(), // Base64url encoded credential ID
  publicKey: text("public_key").notNull(), // Base64url encoded public key
  counter: integer("counter").notNull().default(0), // For clone detection
  transports: text("transports").array().$type<string[]>(), // ['internal', 'usb', 'nfc', 'ble']
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credentials_user_id").on(table.userId),
]);

// Projects table - simplified for photo organization
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"), // Job site address
  latitude: text("latitude"), // GPS latitude for map view
  longitude: text("longitude"), // GPS longitude for map view
  coverPhotoId: varchar("cover_photo_id"), // Reference to photos.id for cover image
  userId: varchar("user_id").references(() => users.id), // Optional - allows offline use
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(), // Track last upload or view
  deletedAt: timestamp("deleted_at"), // Soft delete - null means not deleted
}, (table) => [
  // Partial index for active projects: filter deletedAt IS NULL, sort by createdAt
  index("idx_projects_active").on(table.createdAt).where(sql`${table.deletedAt} IS NULL`),
  // Index for trash queries: filter deletedAt IS NOT NULL, sort by deletedAt
  index("idx_projects_trash").on(table.deletedAt.desc()).where(sql`${table.deletedAt} IS NOT NULL`),
]);

// Photos table
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  photographerId: varchar("photographer_id").references(() => users.id), // Who took the photo
  photographerName: varchar("photographer_name"), // Cached name for offline display
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete - null means not deleted
}, (table) => [
  // Index for joins (getProjectsWithPhotoCounts)
  index("idx_photos_project_id").on(table.projectId),
  // Partial index for active photo queries: filter projectId + deletedAt IS NULL, sort by createdAt
  index("idx_photos_project_active").on(table.projectId, table.deletedAt, table.createdAt).where(sql`${table.deletedAt} IS NULL`),
  // Index for trash queries: filter deletedAt IS NOT NULL, sort by deletedAt
  index("idx_photos_trash").on(table.deletedAt.desc()).where(sql`${table.deletedAt} IS NOT NULL`),
  // Index for photographer queries
  index("idx_photos_photographer_id").on(table.photographerId),
]);

// Photo annotations table
export const photoAnnotations = pgTable("photo_annotations", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // text, arrow, line, circle, pen
  content: text("content"), // For text annotations
  color: varchar("color", { length: 50 }).notNull(),
  strokeWidth: integer("stroke_width").default(4),
  fontSize: integer("font_size"),
  position: jsonb("position").notNull(), // Stores x, y, x2, y2, width, points, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_photo_annotations_photo_id").on(table.photoId),
]);

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mentions: text("mentions").array().$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_comments_photo_id").on(table.photoId),
]);

// Shares table - for generating shareable photo links
export const shares = pgTable("shares", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: varchar("token", { length: 32 }).notNull().unique(), // Unique share link token
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  photoIds: text("photo_ids").array().$type<string[]>().notNull(), // Array of photo IDs to share
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days default
}, (table) => [
  index("idx_shares_project_id").on(table.projectId),
  index("idx_shares_token").on(table.token),
]);

// Tags table - for photo categorization by trade/type
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 50 }).notNull().unique(), // e.g., "Electrician", "HVAC", "Plumber"
  color: varchar("color", { length: 20 }).notNull(), // e.g., "red", "yellow", "blue"
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }), // null = global predefined tags
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tags_project_id").on(table.projectId),
]);

// Photo Tags junction table - many-to-many relationship between photos and tags
export const photoTags = pgTable("photo_tags", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_photo_tags_photo_id").on(table.photoId),
  index("idx_photo_tags_tag_id").on(table.tagId),
]);

// Zod schemas for validation
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true });
export const insertPhotoAnnotationSchema = createInsertSchema(photoAnnotations).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export const insertCredentialSchema = createInsertSchema(credentials).omit({ id: true, createdAt: true });
export const insertShareSchema = createInsertSchema(shares).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, createdAt: true });
export const insertPhotoTagSchema = createInsertSchema(photoTags).omit({ id: true, createdAt: true });

// TypeScript types
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Project = typeof projects.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PhotoAnnotation = typeof photoAnnotations.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type PhotoTag = typeof photoTags.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertPhotoAnnotation = z.infer<typeof insertPhotoAnnotationSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertShare = z.infer<typeof insertShareSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertPhotoTag = z.infer<typeof insertPhotoTagSchema>;

// Annotation types for frontend
export interface Annotation {
  id: string;
  type: "text" | "arrow" | "line" | "circle" | "pen";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  position: {
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    width?: number;
    points?: { x: number; y: number }[];
  };
}
