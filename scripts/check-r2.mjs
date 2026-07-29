import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const required = [
  "R2_BUCKET_NAME",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL",
];

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Missing environment values: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const client = new S3Client({
    region: process.env.AWS_REGION || "auto",
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: "audio/",
      MaxKeys: 1000,
    }));
    console.log(`R2 connection verified for bucket: ${process.env.R2_BUCKET_NAME}`);
    const flacObjects = (result.Contents || []).filter((item) => item.Key?.endsWith(".flac"));
    const storedBytes = flacObjects.reduce((total, item) => total + Number(item.Size || 0), 0);
    console.log(`Audio inventory: ${flacObjects.length} FLAC files, ${(storedBytes / 1024 ** 3).toFixed(2)} GiB`);
    if (flacObjects.length !== 36) {
      console.error("Expected 36 FLAC sessions in the audio prefix.");
      process.exitCode = 1;
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "R2ConnectionError";
    console.error(`R2 connection failed (${name}). Check the bucket name, endpoint, and token permissions.`);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
}
