import { fetchExternalObject } from "../../../../db/external-r2";
import { clerkAuthFromRequest } from "../../../clerk-auth";

const WAVE_IDS = new Set(["wave-i", "wave-ii", "wave-iii", "wave-iv", "wave-v", "wave-vi"]);

export async function GET(request: Request, context: { params: Promise<{ waveId: string }> }) {
  const { userId } = await clerkAuthFromRequest(request);
  if (!userId) return new Response("Authentication required", { status: 401 });

  try {
    const waveId = (await context.params).waveId.toLowerCase();
    if (!WAVE_IDS.has(waveId)) return new Response("Not found", { status: 404 });

    const external = await fetchExternalObject(`manuals/${waveId}.pdf`, request.headers.get("Range"));
    if (!external || external.status === 404) return new Response("Manual not found", { status: 404 });

    const headers = new Headers({
      "Accept-Ranges": external.headers.get("Accept-Ranges") || "bytes",
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    });
    for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
      const value = external.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(external.body, { status: external.status, headers });
  } catch {
    return new Response("Manual unavailable", { status: 500 });
  }
}
