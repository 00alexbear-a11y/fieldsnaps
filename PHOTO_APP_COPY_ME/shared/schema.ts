import { pgTable, varchar, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Projects table - simplified for photo organization
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
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
