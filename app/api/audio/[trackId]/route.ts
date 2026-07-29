import { ensureMediaSchema, getMediaEnv, safeTrackId } from "../../../../db/media";
import { fetchExternalTrack } from "../../../../db/external-r2";

export async function GET(request: Request, context: { params: Promise<{ trackId: string }> }) {
  try {
    const trackId = safeTrackId((await context.params).trackId);
    if (!trackId) return new Response("Not found", { status: 404 });
    const external = await fetchExternalTrack(trackId, request.headers.get("Range"));
    if (external) {
      const headers = new Headers({
        "Accept-Ranges": external.headers.get("Accept-Ranges") || "bytes",
        "Content-Type": external.headers.get("Content-Type") || "audio/flac",
        "Cache-Control": "private, no-store",
      });
      for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
        const value = external.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(external.body, { status: external.status, headers });
    }
    await ensureMediaSchema();
    const { DB, MEDIA } = getMediaEnv();
    const asset = await DB.prepare(
      "SELECT object_key AS objectKey, content_type AS contentType FROM media_assets WHERE track_id = ?1"
    ).bind(trackId).first<{ objectKey: string; contentType: string }>();
    if (!asset) return new Response("Recording not uploaded", { status: 404 });

    const object = await MEDIA.get(asset.objectKey, { range: request.headers });
    if (!object || !object.body) return new Response("Recording not found", { status: 404 });
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Type": asset.contentType || "audio/flac",
      "Cache-Control": "private, no-store",
      ETag: object.httpEtag,
    });
    object.writeHttpMetadata(headers);
    let status = 200;
    if (object.range && "offset" in object.range && "length" in object.range) {
      const start = object.range.offset;
      const end = start + object.range.length - 1;
      headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
      headers.set("Content-Length", String(object.range.length));
      status = 206;
    } else {
      headers.set("Content-Length", String(object.size));
    }
    return new Response(object.body, { status, headers });
  } catch {
    return new Response("Media unavailable", { status: 500 });
  }
}
