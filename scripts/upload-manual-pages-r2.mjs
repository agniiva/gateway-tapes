import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const MANUALS = [
  { id: "wave-i", folder: "Wave I - Discovery", file: "HemiSync - Gateway Experience - Wave I Discovery.pdf", pages: 16 },
  { id: "wave-ii", folder: "Wave II - Threshold", file: "HemiSync - Gateway Experience - Wave II Threshold.pdf", pages: 10 },
  { id: "wave-iii", folder: "Wave III - Freedom", file: "HemiSync - Gateway Experience - Wave III Freedom.pdf", pages: 11 },
  { id: "wave-iv", folder: "Wave IV - Adventure", file: "HemiSync - Gateway Experience - Wave IV Adventure.pdf", pages: 8 },
  { id: "wave-v", folder: "Wave V - Exploring Focus 15", file: "HemiSync - Gateway Experience - Wave V Exploring.pdf", pages: 9 },
  { id: "wave-vi", folder: "Wave VI - Odyssey", file: "HemiSync - Gateway Experience - Wave VI Odyssey.pdf", pages: 11 },
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

function renderPdf(input, prefix) {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftoppm", [
      "-r", "180",
      "-jpeg",
      "-jpegopt", "quality=88,progressive=y,optimize=y",
      input,
      prefix,
    ], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pdftoppm exited with code ${code}`)));
  });
}

const client = dryRun ? null : new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const renderRoot = await mkdtemp(join(tmpdir(), "gateway-manual-pages-"));

try {
  let uploaded = 0;
  for (const manual of MANUALS) {
    const input = join(sourceRoot, manual.folder, manual.file);
    await stat(input);
    const prefix = join(renderRoot, manual.id);
    console.log(`${manual.id}: rendering ${manual.pages} spreads`);
    await renderPdf(input, prefix);
    const rendered = (await readdir(renderRoot))
      .filter((name) => name.startsWith(`${manual.id}-`) && name.endsWith(".jpg"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (rendered.length !== manual.pages) throw new Error(`${manual.id}: expected ${manual.pages} pages, rendered ${rendered.length}`);

    for (const [index, name] of rendered.entries()) {
      const path = join(renderRoot, name);
      const file = await stat(path);
      const page = index + 1;
      const key = `manual-pages/${manual.id}/${String(page).padStart(3, "0")}.jpg`;
      if (dryRun) {
        console.log(`${key} <- ${basename(path)} (${file.size} bytes)`);
        continue;
      }

      let alreadyUploaded = false;
      try {
        const remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        alreadyUploaded = Number(remote.ContentLength) === file.size;
      } catch (error) {
        const status = error?.$metadata?.httpStatusCode;
        if (status !== 404 && error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
      }
      if (!alreadyUploaded) {
        await new Upload({
          client,
          params: {
            Bucket: bucket,
            Key: key,
            Body: createReadStream(path),
            ContentType: "image/jpeg",
            Metadata: { waveid: manual.id, spread: String(page) },
          },
          leavePartsOnError: false,
        }).done();
      }
      uploaded += 1;
      console.log(`${manual.id}: page ${page}/${manual.pages} ${alreadyUploaded ? "already present" : "uploaded"}`);
    }
  }
  console.log(dryRun ? "Rendered and validated all manual pages; no files uploaded." : `All ${uploaded} rendered manual pages are present in R2.`);
} finally {
  client?.destroy();
  await rm(renderRoot, { recursive: true, force: true });
}
