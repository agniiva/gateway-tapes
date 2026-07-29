import { ensureMediaSchema, getMediaEnv, requireUploader, safeTrackId } from "../../../../db/media";

type UploadedPart = { partNumber: number; etag: string };

export async function POST(request: Request) {
  try {
    const email = requireUploader(request);
    await ensureMediaSchema();
    const payload = (await request.json()) as {
      trackId?: string; key?: string; uploadId?: string; fileName?: string; contentType?: string; size?: number; parts?: UploadedPart[];
    };
    const trackId = safeTrackId(payload.trackId);
    if (!trackId || !payload.key?.startsWith(`audio/${trackId}/`) || !payload.uploadId || !payload.fileName || !Array.isArray(payload.parts) || !payload.parts.length) {
      return Response.json({ error: "Invalid upload completion." }, { status: 400 });
    }

    const { DB, MEDIA } = getMediaEnv();
    await MEDIA.resumeMultipartUpload(payload.key, payload.uploadId).complete(payload.parts);
    const existing = await DB.prepare("SELECT object_key AS objectKey FROM media_assets WHERE track_id = ?1").bind(trackId).first<{ objectKey: string }>();
    await DB.prepare(`
      INSERT INTO media_assets (track_id, object_key, file_name, content_type, size, uploaded_by, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
      ON CONFLICT(track_id) DO UPDATE SET
        object_key = excluded.object_key,
        file_name = excluded.file_name,
        content_type = excluded.content_type,
        size = excluded.size,
        uploaded_by = excluded.uploaded_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(trackId, payload.key, payload.fileName, payload.contentType || "audio/flac", Number(payload.size) || 0, email).run();
    if (existing?.objectKey && existing.objectKey !== payload.key) await MEDIA.delete(existing.objectKey);
    return Response.json({ trackId, url: `/api/audio/${trackId}` });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Only the site owner can upload recordings." }, { status: 401 });
    }
    return Response.json({ error: "Could not finish the upload." }, { status: 500 });
  }
}
