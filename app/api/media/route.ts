import { ensureMediaSchema, getMediaEnv } from "../../../db/media";
import { GATEWAY_TRACK_IDS, hasExternalR2 } from "../../../db/external-r2";

export async function GET() {
  try {
    if (hasExternalR2()) {
      return Response.json({
        assets: GATEWAY_TRACK_IDS.map((trackId) => ({
          trackId,
          fileName: `${trackId}.flac`,
          size: 0,
          updatedAt: "",
          url: `/api/audio/${trackId}`,
        })),
      });
    }
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
