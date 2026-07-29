import { env } from "cloudflare:workers";
import { AwsClient } from "aws4fetch";

export const GATEWAY_TRACK_IDS = [
  "wave-i-orientation", "wave-i-focus-10", "wave-i-advanced-focus-10", "wave-i-release-recharge", "wave-i-exploration-sleep", "wave-i-free-flow-10",
  "wave-ii-focus-12", "wave-ii-problem-solving", "wave-ii-month-patterning", "wave-ii-color-breathing", "wave-ii-energy-bar", "wave-ii-living-body-map",
  "wave-iii-lift-off", "wave-iii-remote-viewing", "wave-iii-vectors", "wave-iii-five-questions", "wave-iii-energy-food", "wave-iii-separation",
  "wave-iv-year-patterning", "wave-iv-five-messages", "wave-iv-free-flow-12", "wave-iv-nvc-i", "wave-iv-nvc-ii", "wave-iv-compoint",
  "wave-v-advanced-focus-12", "wave-v-discovering-intuition", "wave-v-exploring-intuition", "wave-v-focus-15", "wave-v-mission-15", "wave-v-exploring-focus-15",
  "wave-vi-locale-one", "wave-vi-expansion-locale-one", "wave-vi-departure", "wave-vi-friends", "wave-vi-locale-two", "wave-vi-free-flow-21",
] as const;

type ExternalR2Env = {
  R2_EXTERNAL_ENDPOINT?: string;
  R2_EXTERNAL_BUCKET?: string;
  R2_EXTERNAL_ACCESS_KEY_ID?: string;
  R2_EXTERNAL_SECRET_ACCESS_KEY?: string;
  AWS_ENDPOINT_URL?: string;
  R2_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
};

function configuration() {
  const values = env as unknown as ExternalR2Env;
  const endpoint = values.R2_EXTERNAL_ENDPOINT || values.AWS_ENDPOINT_URL;
  const bucket = values.R2_EXTERNAL_BUCKET || values.R2_BUCKET_NAME;
  const accessKeyId = values.R2_EXTERNAL_ACCESS_KEY_ID || values.AWS_ACCESS_KEY_ID;
  const secretAccessKey = values.R2_EXTERNAL_SECRET_ACCESS_KEY || values.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint: endpoint.replace(/\/$/, ""), bucket, accessKeyId, secretAccessKey };
}

export function hasExternalR2() {
  return Boolean(configuration());
}

export async function fetchExternalObject(key: string, range?: string | null) {
  const config = configuration();
  if (!config) return null;
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const headers = new Headers();
  if (range) headers.set("Range", range);
  return client.fetch(`${config.endpoint}/${config.bucket}/${key}`, { headers });
}

export function fetchExternalTrack(trackId: string, range?: string | null) {
  return fetchExternalObject(`audio/${trackId}.flac`, range);
}
