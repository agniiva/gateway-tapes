import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const MANUALS = [
  { id: "wave-i", folder: "Wave I - Discovery", file: "HemiSync - Gateway Experience - Wave I Discovery.pdf" },
  { id: "wave-ii", folder: "Wave II - Threshold", file: "HemiSync - Gateway Experience - Wave II Threshold.pdf" },
  { id: "wave-iii", folder: "Wave III - Freedom", file: "HemiSync - Gateway Experience - Wave III Freedom.pdf" },
  { id: "wave-iv", folder: "Wave IV - Adventure", file: "HemiSync - Gateway Experience - Wave IV Adventure.pdf" },
  { id: "wave-v", folder: "Wave V - Exploring Focus 15", file: "HemiSync - Gateway Experience - Wave V Exploring.pdf" },
  { id: "wave-vi", folder: "Wave VI - Odyssey", file: "HemiSync - Gateway Experience - Wave VI Odyssey.pdf" },
];

const sourceRoot = process.env.HEMISYNC_SOURCE_DIR || join(
  homedir(),
  "Desktop",
  "hemisync",
  "Hemi-Sync - The Gateway Experience [FLAC] (corrected)",
);
const bucket = process.env.R2_BUCKET_NAME;
const dryRun = process.argv.includes("--dry-run");
const required = ["R2_BUCKET_NAME", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing environment values: ${missing.join(", ")}`);

const mapped = MANUALS.map((manual) => ({
  ...manual,
  filePath: join(sourceRoot, manual.folder, manual.file),
  key: `manuals/${manual.id}.pdf`,
}));

for (const manual of mapped) await stat(manual.filePath);

if (dryRun) {
  for (const manual of mapped) console.log(`${manual.key} <- ${basename(manual.filePath)}`);
  console.log(`Validated ${mapped.length} manuals. No files uploaded.`);
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
  for (const [index, manual] of mapped.entries()) {
    const file = await stat(manual.filePath);
    let alreadyUploaded = false;
    try {
      const remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: manual.key }));
      alreadyUploaded = Number(remote.ContentLength) === file.size;
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status !== 404 && error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
    }

    const label = `[${index + 1}/6] ${manual.id}`;
    if (alreadyUploaded) {
      console.log(`${label} already uploaded; skipped`);
      continue;
    }

    console.log(`${label} uploading`);
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: manual.key,
        Body: createReadStream(manual.filePath),
        ContentType: "application/pdf",
        ContentDisposition: "inline",
        Metadata: { waveid: manual.id, filename: basename(manual.filePath) },
      },
      leavePartsOnError: false,
    });
    await upload.done();
    console.log(`${label} complete`);
  }
  console.log("All six Gateway manuals are present in R2.");
} finally {
  client.destroy();
}
