import { ensureMediaSchema, getBoundMediaBucket, getMediaEnv, safeTrackId } from "../../../../db/media";
import { fetchExternalTrack } from "../../../../db/external-r2";
import { clerkAuthFromRequest } from "../../../clerk-auth";

const STREAM_CHUNK_BYTES = 8 * 1024 * 1024;

function boundedStreamRange(request: Request, downloadRequested: boolean) {
  const requested = request.headers.get("Range");
  if (!requested || downloadRequested) return requested;
  const match = /^bytes=(\d+)-(\d*)$/.exec(requested.trim());
  if (!match) return requested;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : Number.POSITIVE_INFINITY;
  const cappedEnd = Math.min(requestedEnd, start + STREAM_CHUNK_BYTES - 1);
  return `bytes=${start}-${cappedEnd}`;
}

function rangeHeaders(range: string | null) {
  return range ? new Headers({ Range: range }) : undefined;
}

function setDownloadDisposition(headers: Headers, trackId: string, requested: boolean) {
  if (requested) headers.set("Content-Disposition", `attachment; filename="${trackId}.flac"`);
}

export async function GET(request: Request, context: { params: Promise<{ trackId: string }> }) {
  const { userId } = await clerkAuthFromRequest(request);
  if (!userId) return new Response("Authentication required", { status: 401 });

  try {
    const trackId = safeTrackId((await context.params).trackId);
    if (!trackId) return new Response("Not found", { status: 404 });
    const downloadRequested = new URL(request.url).searchParams.get("download") === "1";
    const requestedRange = boundedStreamRange(request, downloadRequested);
    const boundBucket = getBoundMediaBucket();
    if (boundBucket) {
      const object = await boundBucket.get(`audio/${trackId}.flac`, { range: rangeHeaders(requestedRange) });
      if (object?.body) {
        const headers = new Headers({
          "Accept-Ranges": "bytes",
          "Content-Type": object.httpMetadata?.contentType || "audio/flac",
          "Cache-Control": "private, no-store",
          ETag: object.httpEtag,
        });
        setDownloadDisposition(headers, trackId, downloadRequested);
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
      }
    }
    const external = await fetchExternalTrack(trackId, requestedRange);
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
      setDownloadDisposition(headers, trackId, downloadRequested);
      return new Response(external.body, { status: external.status, headers });
    }
    await ensureMediaSchema();
    const { DB, MEDIA } = getMediaEnv();
    const asset = await DB.prepare(
      "SELECT object_key AS objectKey, content_type AS contentType FROM media_assets WHERE track_id = ?1"
    ).bind(trackId).first<{ objectKey: string; contentType: string }>();
    if (!asset) return new Response("Recording not uploaded", { status: 404 });

    const object = await MEDIA.get(asset.objectKey, { range: rangeHeaders(requestedRange) });
    if (!object || !object.body) return new Response("Recording not found", { status: 404 });
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Type": asset.contentType || "audio/flac",
      "Cache-Control": "private, no-store",
      ETag: object.httpEtag,
    });
    object.writeHttpMetadata(headers);
    setDownloadDisposition(headers, trackId, downloadRequested);
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
