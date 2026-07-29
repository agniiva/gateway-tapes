import { ensureMediaSchema, getMediaEnv, requireUploader, safeTrackId } from "../../../../db/media";

export async function POST(request: Request) {
  try {
    requireUploader(request);
    await ensureMediaSchema();
    const payload = (await request.json()) as { trackId?: string; fileName?: string; contentType?: string; size?: number };
    const trackId = safeTrackId(payload.trackId);
    const fileName = payload.fileName?.trim() ?? "";
    const isFlac = fileName.toLowerCase().endsWith(".flac") || payload.contentType === "audio/flac" || payload.contentType === "audio/x-flac";
    if (!trackId || !fileName || !isFlac || !Number.isFinite(payload.size) || Number(payload.size) <= 0) {
      return Response.json({ error: "Choose a valid FLAC file and session." }, { status: 400 });
    }

    const { MEDIA } = getMediaEnv();
    const key = `audio/${trackId}/${crypto.randomUUID()}.flac`;
    const upload = await MEDIA.createMultipartUpload(key, {
      httpMetadata: { contentType: "audio/flac", cacheControl: "private, max-age=0" },
      customMetadata: { trackId, fileName },
    });
    return Response.json({ key, uploadId: upload.uploadId });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Only the site owner can upload recordings." }, { status: 401 });
    }
    return Response.json({ error: "Could not begin the upload." }, { status: 500 });
  }
}
