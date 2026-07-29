import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mediaAssets = sqliteTable("media_assets", {
  trackId: text("track_id").primaryKey(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull().default("audio/flac"),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
