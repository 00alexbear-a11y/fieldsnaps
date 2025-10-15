import { pgTable, varchar, text, timestamp, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
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
  // Subscription fields (for future Stripe integration)
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial, active, past_due, canceled, none
  stripeCustomerId: varchar("stripe_customer_id"),
  trialEndDate: timestamp("trial_end_date"),
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
  completed: boolean("completed").default(false).notNull(), // Mark job as complete
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
  mediaType: varchar("media_type", { length: 10 }).default('photo').notNull(), // 'photo' or 'video'
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

// Shares table - for generating shareable project links (shows all active photos)
export const shares = pgTable("shares", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: varchar("token", { length: 32 }).notNull().unique(), // Unique share link token
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration (null = never expires)
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

// Subscriptions table - current state for future Stripe billing integration
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  stripePriceId: varchar("stripe_price_id"), // $19.99/month price ID
  status: varchar("status").notNull(), // active, past_due, canceled, trialing
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").default(0).notNull(), // boolean stored as integer (0/1)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_subscriptions_user_id").on(table.userId),
  index("idx_subscriptions_stripe_id").on(table.stripeSubscriptionId),
]);

// Subscription events table - audit trail for billing history
export const subscriptionEvents = pgTable("subscription_events", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(), // subscription.created, subscription.updated, subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
  stripeEventId: varchar("stripe_event_id").unique(), // Stripe webhook event ID for idempotency
  status: varchar("status"), // Subscription status at time of event
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  amountPaid: integer("amount_paid"), // In cents (e.g., 1999 for $19.99)
  metadata: jsonb("metadata"), // Additional webhook data
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_subscription_events_subscription_id").on(table.subscriptionId),
  index("idx_subscription_events_stripe_event_id").on(table.stripeEventId),
  index("idx_subscription_events_created_at").on(table.createdAt.desc()),
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
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionEventSchema = createInsertSchema(subscriptionEvents).omit({ id: true, createdAt: true });

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
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertPhotoAnnotation = z.infer<typeof insertPhotoAnnotationSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertShare = z.infer<typeof insertShareSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertPhotoTag = z.infer<typeof insertPhotoTagSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertSubscriptionEvent = z.infer<typeof insertSubscriptionEventSchema>;

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
