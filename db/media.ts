import { env } from "cloudflare:workers";

type MediaEnv = {
  DB: D1Database;
  MEDIA: R2Bucket;
};

let schemaReady: Promise<unknown> | null = null;

export function getMediaEnv() {
  const bindings = env as unknown as Partial<MediaEnv>;
  if (!bindings.DB || !bindings.MEDIA) {
    throw new Error("Media storage is not available in this environment.");
  }
  return bindings as MediaEnv;
}

export function getBoundMediaBucket() {
  const bindings = env as unknown as Partial<MediaEnv>;
  return bindings.MEDIA ?? null;
}

export function ensureMediaSchema() {
  const { DB } = getMediaEnv();
  schemaReady ??= DB.prepare(`
    CREATE TABLE IF NOT EXISTS media_assets (
      track_id TEXT PRIMARY KEY,
      object_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'audio/flac',
      size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  return schemaReady;
}

export function requireUploader(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) throw new Error("AUTH_REQUIRED");
  return email;
}

export function safeTrackId(value: unknown) {
  return typeof value === "string" && /^wave-[ivx]+-[a-z0-9-]+$/.test(value) ? value : null;
}
