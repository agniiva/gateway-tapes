import { fetchExternalObject } from "../../../../../db/external-r2";
import { clerkAuthFromRequest } from "../../../../clerk-auth";

const PAGE_COUNTS: Record<string, number> = {
  "wave-i": 16,
  "wave-ii": 10,
  "wave-iii": 11,
  "wave-iv": 8,
  "wave-v": 9,
  "wave-vi": 11,
};

export async function GET(request: Request, context: { params: Promise<{ waveId: string; page: string }> }) {
  const { userId } = await clerkAuthFromRequest(request);
  if (!userId) return new Response("Authentication required", { status: 401 });

  try {
    const { waveId, page: rawPage } = await context.params;
    const page = Number(rawPage);
    if (!PAGE_COUNTS[waveId] || !Number.isInteger(page) || page < 1 || page > PAGE_COUNTS[waveId]) {
      return new Response("Not found", { status: 404 });
    }

    const key = `manual-pages/${waveId}/${String(page).padStart(3, "0")}.jpg`;
    const external = await fetchExternalObject(key, request.headers.get("Range"));
    if (!external || external.status === 404) return new Response("Page not found", { status: 404 });

    const headers = new Headers({
      "Accept-Ranges": external.headers.get("Accept-Ranges") || "bytes",
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    });
    for (const name of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
      const value = external.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(external.body, { status: external.status, headers });
  } catch {
    return new Response("Page unavailable", { status: 500 });
  }
}
