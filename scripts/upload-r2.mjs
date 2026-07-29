import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const TRACKS = {
  I: ["orientation", "focus-10", "advanced-focus-10", "release-recharge", "exploration-sleep", "free-flow-10"],
  II: ["focus-12", "problem-solving", "month-patterning", "color-breathing", "energy-bar", "living-body-map"],
  III: ["lift-off", "remote-viewing", "vectors", "five-questions", "energy-food", "separation"],
  IV: ["year-patterning", "five-messages", "free-flow-12", "nvc-i", "nvc-ii", "compoint"],
  V: ["advanced-focus-12", "discovering-intuition", "exploring-intuition", "focus-15", "mission-15", "exploring-focus-15"],
  VI: ["locale-one", "expansion-locale-one", "departure", "friends", "locale-two", "free-flow-21"],
};

const sourceRoot = process.env.HEMISYNC_SOURCE_DIR || join(
  homedir(),
  "Desktop",
  "hemisync",
  "Hemi-Sync - The Gateway Experience [FLAC] (corrected)",
);
const dryRun = process.argv.includes("--dry-run");
const bucket = process.env.R2_BUCKET_NAME;

async function collectFlacFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFlacFiles(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".flac")) files.push(path);
  }
  return files;
}

function identify(filePath) {
  const wave = filePath.match(/Wave (I|II|III|IV|V|VI) -/)?.[1];
  const trackNumber = Number(basename(filePath).match(/CD\d+ - (\d+) - /)?.[1]);
  const slug = wave && TRACKS[wave]?.[trackNumber - 1];
  if (!wave || !slug) throw new Error(`Could not map file: ${basename(filePath)}`);
  const trackId = `wave-${wave.toLowerCase()}-${slug}`;
  return { filePath, trackId, key: `audio/${trackId}.flac`, wave, trackNumber };
}

const required = ["R2_BUCKET_NAME", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing environment values: ${missing.join(", ")}`);

const mapped = (await collectFlacFiles(sourceRoot)).map(identify).sort((a, b) => {
  const waveOrder = ["I", "II", "III", "IV", "V", "VI"];
  return waveOrder.indexOf(a.wave) - waveOrder.indexOf(b.wave) || a.trackNumber - b.trackNumber;
});
const uniqueIds = new Set(mapped.map((item) => item.trackId));
if (mapped.length !== 36 || uniqueIds.size !== 36) {
  throw new Error(`Expected 36 unique FLAC sessions, found ${mapped.length} files and ${uniqueIds.size} track IDs.`);
}

if (dryRun) {
  for (const [index, item] of mapped.entries()) {
    console.log(`${String(index + 1).padStart(2, "0")} ${item.trackId} <- ${basename(item.filePath)}`);
  }
  console.log(`Validated ${mapped.length} unique sessions. No files uploaded.`);
  process.exit(0);
}

const client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

try {
  for (const [index, item] of mapped.entries()) {
    const file = await stat(item.filePath);
    let alreadyUploaded = false;
    try {
      const remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: item.key }));
      alreadyUploaded = Number(remote.ContentLength) === file.size;
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status !== 404 && error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
    }

    const label = `[${String(index + 1).padStart(2, "0")}/36] ${item.trackId}`;
    if (alreadyUploaded) {
      console.log(`${label} already uploaded; skipped`);
      continue;
    }

    console.log(`${label} uploading`);
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: item.key,
        Body: createReadStream(item.filePath),
        ContentType: "audio/flac",
        Metadata: { trackid: item.trackId, filename: basename(item.filePath) },
      },
      queueSize: 3,
      partSize: 16 * 1024 * 1024,
      leavePartsOnError: false,
    });
    let reported = 0;
    upload.on("httpUploadProgress", ({ loaded = 0, total = file.size }) => {
      const percentage = Math.min(100, Math.floor((loaded / total) * 100));
      if (percentage >= reported + 25) {
        reported = Math.floor(percentage / 25) * 25;
        console.log(`${label} ${reported}%`);
      }
    });
    await upload.done();
    console.log(`${label} complete`);
  }
  console.log("All 36 FLAC sessions are present in R2.");
} finally {
  client.destroy();
}
