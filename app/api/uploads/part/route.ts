import { getMediaEnv, requireUploader } from "../../../../db/media";

export async function PUT(request: Request) {
  try {
    requireUploader(request);
    if (!request.body) return Response.json({ error: "Missing upload data." }, { status: 400 });
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const uploadId = url.searchParams.get("uploadId");
    const partNumber = Number(url.searchParams.get("partNumber"));
    if (!key?.startsWith("audio/") || !uploadId || !Number.isInteger(partNumber) || partNumber < 1) {
      return Response.json({ error: "Invalid upload part." }, { status: 400 });
    }
    const { MEDIA } = getMediaEnv();
    const upload = MEDIA.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    return Response.json({ partNumber: part.partNumber, etag: part.etag });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Only the site owner can upload recordings." }, { status: 401 });
    }
    return Response.json({ error: "A file part could not be uploaded." }, { status: 500 });
  }
}
