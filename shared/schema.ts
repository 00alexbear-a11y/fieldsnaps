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

// Projects table - simplified for photo organization
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  userId: varchar("user_id").references(() => users.id), // Optional - allows offline use
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Photos table
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mentions: text("mentions").array().$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true });
export const insertPhotoAnnotationSchema = createInsertSchema(photoAnnotations).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });

// TypeScript types
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PhotoAnnotation = typeof photoAnnotations.$inferSelect;
export type Comment = typeof comments.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertPhotoAnnotation = z.infer<typeof insertPhotoAnnotationSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;

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
