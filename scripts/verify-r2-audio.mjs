import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "node:child_process";
import { once } from "node:events";

const required = ["R2_BUCKET_NAME", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing environment values: ${missing.join(", ")}`);

const decode = process.argv.includes("--decode");
const concurrency = Math.max(1, Math.min(6, Number(process.env.VERIFY_CONCURRENCY || 3)));
const client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function readRange(key, start, end) {
  const response = await client.send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Range: `bytes=${start}-${end}`,
  }));
  const bytes = await response.Body.transformToByteArray();
  const expected = end - start + 1;
  if (response.$metadata.httpStatusCode !== 206 || bytes.length !== expected) {
    throw new Error(`Invalid range response at ${start}-${end}: status=${response.$metadata.httpStatusCode}, bytes=${bytes.length}`);
  }
  return bytes;
}

async function verifyRanges(object) {
  const size = Number(object.Size || 0);
  if (size < 196608) throw new Error(`Object is unexpectedly small (${size} bytes)`);
  const first = await readRange(object.Key, 0, 65535);
  if (Buffer.from(first.subarray(0, 4)).toString("ascii") !== "fLaC") {
    throw new Error("Missing FLAC stream marker");
  }
  const middle = Math.floor(size / 2);
  await readRange(object.Key, middle, middle + 65535);
  await readRange(object.Key, size - 65536, size - 1);
}

async function decodeObject(object) {
  const response = await client.send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: object.Key,
  }));
  const decoder = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-err_detect", "explode",
    "-i", "pipe:0", "-map", "0:a:0", "-f", "null", "-",
  ], { stdio: ["pipe", "ignore", "pipe"] });
  let diagnostics = "";
  decoder.stderr.on("data", (chunk) => { diagnostics = `${diagnostics}${chunk}`.slice(-4000); });
  response.Body.pipe(decoder.stdin);
  const [code] = await once(decoder, "close");
  if (code !== 0) throw new Error(diagnostics.trim() || `ffmpeg exited with code ${code}`);
}

try {
  const listed = await client.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME,
    Prefix: "audio/",
    MaxKeys: 1000,
  }));
  const objects = (listed.Contents || []).filter((object) => object.Key?.endsWith(".flac"));
  if (objects.length !== 36) throw new Error(`Expected 36 FLAC files, found ${objects.length}`);

  let cursor = 0;
  let completed = 0;
  const failures = [];
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < objects.length) {
      const object = objects[cursor++];
      try {
        await verifyRanges(object);
        if (decode) await decodeObject(object);
        completed += 1;
        console.log(`[${completed}/${objects.length}] verified ${object.Key}`);
      } catch (error) {
        completed += 1;
        failures.push({ key: object.Key, message: error instanceof Error ? error.message : String(error) });
        console.error(`[${completed}/${objects.length}] failed ${object.Key}`);
      }
    }
  });
  await Promise.all(workers);

  if (failures.length) {
    for (const failure of failures) console.error(`${failure.key}: ${failure.message}`);
    process.exitCode = 1;
  } else {
    console.log(`${objects.length} FLAC files passed range checks${decode ? " and complete decode verification" : ""}.`);
  }
} finally {
  client.destroy();
}
