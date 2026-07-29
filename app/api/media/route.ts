import { ensureMediaSchema, getMediaEnv } from "../../../db/media";

export async function GET() {
  try {
    await ensureMediaSchema();
    const { DB } = getMediaEnv();
    const result = await DB.prepare(
      "SELECT track_id AS trackId, file_name AS fileName, size, updated_at AS updatedAt FROM media_assets ORDER BY track_id"
    ).all<{ trackId: string; fileName: string; size: number; updatedAt: string }>();

    return Response.json({
      assets: result.results.map((asset) => ({ ...asset, url: `/api/audio/${asset.trackId}` })),
    });
  } catch {
    return Response.json({ assets: [] });
  }
}
