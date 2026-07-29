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
    await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 1,
    }));
    console.log(`R2 connection verified for bucket: ${process.env.R2_BUCKET_NAME}`);
  } catch (error) {
    const name = error instanceof Error ? error.name : "R2ConnectionError";
    console.error(`R2 connection failed (${name}). Check the bucket name, endpoint, and token permissions.`);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
}
