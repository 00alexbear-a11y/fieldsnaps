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

// Companies table - team/organization structure
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: varchar("owner_id").notNull(), // Original creator who pays (FK enforced at app level to avoid circular ref)
  
  // Multi-platform subscription support
  subscriptionSource: varchar("subscription_source").default("stripe"), // stripe | apple | google | none
  platformSubscriptionId: text("platform_subscription_id"), // Apple receipt or Google purchase token
  
  // Stripe-specific fields (backwards compatible)
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  
  // Unified subscription fields
  subscriptionQuantity: integer("subscription_quantity").default(1).notNull(), // Number of users owner pays for
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial, active, past_due, canceled, none
  trialEndsAt: timestamp("trial_ends_at"), // When trial expires (7 days from creation)
  
  // Team invite system
  inviteLinkToken: varchar("invite_link_token", { length: 32 }).unique(), // Current invite link token
  inviteLinkUses: integer("invite_link_uses").default(0).notNull(), // How many joined via current link
  inviteLinkMaxUses: integer("invite_link_max_uses").default(5).notNull(), // Max uses before expiry
  inviteLinkExpiresAt: timestamp("invite_link_expires_at"), // 7 days from generation
  
  // PDF export settings
  pdfLogoUrl: text("pdf_logo_url"), // Logo URL in Object Storage
  pdfCompanyName: varchar("pdf_company_name", { length: 255 }),
  pdfCompanyAddress: text("pdf_company_address"),
  pdfCompanyPhone: varchar("pdf_company_phone", { length: 50 }),
  pdfHeaderText: text("pdf_header_text"),
  pdfFooterText: text("pdf_footer_text"),
  pdfFontFamily: varchar("pdf_font_family", { length: 50 }).default("Arial"), // Arial, Helvetica, Times
  pdfFontSizeTitle: integer("pdf_font_size_title").default(24),
  pdfFontSizeHeader: integer("pdf_font_size_header").default(16),
  pdfFontSizeBody: integer("pdf_font_size_body").default(12),
  pdfFontSizeCaption: integer("pdf_font_size_caption").default(10),
  pdfDefaultGridLayout: integer("pdf_default_grid_layout").default(2), // 1, 2, 3, or 4 photos per page
  pdfIncludeTimestamp: boolean("pdf_include_timestamp").default(true),
  pdfIncludeTags: boolean("pdf_include_tags").default(true),
  pdfIncludeAnnotations: boolean("pdf_include_annotations").default(true),
  pdfIncludeSignatureLine: boolean("pdf_include_signature_line").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_companies_owner_id").on(table.ownerId),
  index("idx_companies_invite_token").on(table.inviteLinkToken),
  index("idx_companies_subscription_source").on(table.subscriptionSource),
]);

// Users table (for authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  role: varchar("role").default("member"), // owner or member
  invitedBy: varchar("invited_by").references(() => users.id, { onDelete: "set null" }), // Who invited this user
  removedAt: timestamp("removed_at"), // Timestamp when removed from company (for grace period)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Legacy subscription fields (kept for backwards compatibility during migration)
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial, active, past_due, canceled, none
  stripeCustomerId: varchar("stripe_customer_id"),
  trialStartDate: timestamp("trial_start_date"), // When trial started (on first project creation)
  trialEndDate: timestamp("trial_end_date"),
  pastDueSince: timestamp("past_due_since"), // When payment failed (for 14-day grace period)
}, (table) => [
  index("idx_users_company_id").on(table.companyId),
  index("idx_users_invited_by").on(table.invitedBy),
]);

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

// Refresh tokens table (for JWT authentication persistence)
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(), // The actual refresh token
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(), // When this token expires (30 days)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"), // Track when token was last used for refresh
}, (table) => [
  index("idx_refresh_tokens_user_id").on(table.userId),
  index("idx_refresh_tokens_expires_at").on(table.expiresAt), // For cleanup queries
  index("idx_refresh_tokens_token").on(table.token), // For fast lookups
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
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // Company that owns this project
  createdBy: varchar("created_by").references(() => users.id), // User who created the project
  completed: boolean("completed").default(false).notNull(), // Mark job as complete
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(), // Track last upload or view
  deletedAt: timestamp("deleted_at"), // Soft delete - null means not deleted
  // Legacy field for backwards compatibility
  userId: varchar("user_id").references(() => users.id), // Optional - allows offline use
}, (table) => [
  // Partial index for active projects: filter deletedAt IS NULL, sort by createdAt
  index("idx_projects_active").on(table.createdAt).where(sql`${table.deletedAt} IS NULL`),
  // Index for trash queries: filter deletedAt IS NOT NULL, sort by deletedAt
  index("idx_projects_trash").on(table.deletedAt.desc()).where(sql`${table.deletedAt} IS NOT NULL`),
  index("idx_projects_company_id").on(table.companyId),
  index("idx_projects_created_by").on(table.createdBy),
]);

// Photos table
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }), // Nullable for standalone photos (e.g., todo attachments)
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"), // 200x200px thumbnail for fast gallery loading
  mediaType: varchar("media_type", { length: 10 }).default('photo').notNull(), // 'photo' or 'video'
  caption: text("caption"),
  width: integer("width"), // Original photo width in pixels
  height: integer("height"), // Original photo height in pixels
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
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Annotation author (nullable for backwards compat)
  type: varchar("type", { length: 50 }).notNull(), // text, arrow, line, circle, pen
  content: text("content"), // For text annotations
  color: varchar("color", { length: 50 }).notNull(),
  strokeWidth: integer("stroke_width").default(4),
  fontSize: integer("font_size"),
  position: jsonb("position").notNull(), // Stores x, y, x2, y2, width, points, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_photo_annotations_photo_id").on(table.photoId),
  index("idx_photo_annotations_user_id").on(table.userId),
]);

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Comment author (nullable for backwards compat)
  content: text("content").notNull(),
  mentions: text("mentions").array().$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_comments_photo_id").on(table.photoId),
  index("idx_comments_user_id").on(table.userId),
]);

// Tasks table - lightweight task management for photo documentation
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), // Tasks die with projects
  taskName: text("task_name").notNull(),
  assignedTo: varchar("assigned_to").notNull().references(() => users.id, { onDelete: "cascade" }), // Must be user in same company
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Who created the task
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id, { onDelete: "set null" }), // Who completed it
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tasks_project_id").on(table.projectId),
  index("idx_tasks_assigned_to").on(table.assignedTo),
  index("idx_tasks_created_by").on(table.createdBy),
  index("idx_tasks_completed").on(table.completed),
]);

// ToDos table - team to-do list with optional photo attachments
export const todos = pgTable("todos", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }), // Optional - can be general todos
  photoId: varchar("photo_id").references(() => photos.id, { onDelete: "set null" }), // Optional - attached photo for context
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "cascade" }), // Optional - who needs to do it (defaults to creator if null)
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Who created it
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id, { onDelete: "set null" }), // Who marked complete
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_todos_project_id").on(table.projectId),
  index("idx_todos_photo_id").on(table.photoId),
  index("idx_todos_assigned_to").on(table.assignedTo),
  index("idx_todos_created_by").on(table.createdBy),
  index("idx_todos_completed").on(table.completed),
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

// PDFs table - track generated PDF exports
export const pdfs = pgTable("pdfs", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storageUrl: text("storage_url").notNull(), // URL in Object Storage
  photoCount: integer("photo_count").notNull().default(0),
  gridLayout: integer("grid_layout").notNull().default(2), // 1, 2, 3, or 4 photos per page
  settings: jsonb("settings"), // Snapshot of PDF settings at generation time
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pdfs_project_id").on(table.projectId),
  index("idx_pdfs_created_by").on(table.createdBy),
  index("idx_pdfs_created_at").on(table.createdAt.desc()),
]);

// Subscriptions table - company-based subscriptions (owner pays for whole team)
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), // Company (not user)
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  stripePriceId: varchar("stripe_price_id"), // $19.99/month price ID
  quantity: integer("quantity").default(1).notNull(), // Number of users owner pays for
  status: varchar("status").notNull(), // active, past_due, canceled, trialing
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").default(0).notNull(), // boolean stored as integer (0/1)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Legacy field for backwards compatibility during migration
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_subscriptions_company_id").on(table.companyId),
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
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true });
export const insertPhotoAnnotationSchema = createInsertSchema(photoAnnotations).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertTodoSchema = createInsertSchema(todos).omit({ id: true, createdAt: true }).extend({
  dueDate: z.coerce.date().optional(),
});
export const insertCredentialSchema = createInsertSchema(credentials).omit({ id: true, createdAt: true });
export const insertShareSchema = createInsertSchema(shares).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, createdAt: true });
export const insertPhotoTagSchema = createInsertSchema(photoTags).omit({ id: true, createdAt: true });
export const insertPdfSchema = createInsertSchema(pdfs).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionEventSchema = createInsertSchema(subscriptionEvents).omit({ id: true, createdAt: true });

// TypeScript types
export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Project = typeof projects.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PhotoAnnotation = typeof photoAnnotations.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ToDo = typeof todos.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type PhotoTag = typeof photoTags.$inferSelect;
export type Pdf = typeof pdfs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertPhotoAnnotation = z.infer<typeof insertPhotoAnnotationSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertToDo = z.infer<typeof insertTodoSchema>;
export type InsertShare = z.infer<typeof insertShareSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertPhotoTag = z.infer<typeof insertPhotoTagSchema>;
export type InsertPdf = z.infer<typeof insertPdfSchema>;
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
