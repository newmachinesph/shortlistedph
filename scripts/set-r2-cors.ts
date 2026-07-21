/**
 * Sets the CORS policy on the R2 bucket so the browser can PUT resumes and
 * recordings straight to the presigned URL.
 *
 *   node --experimental-strip-types scripts/set-r2-cors.ts
 *
 * Without this, /api/talent/resume/upload-url hands back a valid presigned URL
 * but the browser's PUT is blocked ("No Access-Control-Allow-Origin"), so the
 * whole upload → parse → profile flow dies at the first step. Additive: it only
 * grants the app's own origins permission to upload.
 */
import { config } from "dotenv";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

config({ path: ".env.local" });

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`\n  ${key} is not set in .env.local.\n`);
    process.exit(1);
  }
  return v;
}

const ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://shortlisted.ph",
  "https://www.shortlisted.ph",
];

async function main() {
  const accountId = required("R2_ACCOUNT_ID");
  const bucket = required("R2_BUCKET");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGINS,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  const check = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log(`  CORS set on bucket "${bucket}". Allowed origins:`);
  for (const rule of check.CORSRules ?? []) {
    for (const o of rule.AllowedOrigins ?? []) console.log(`   - ${o}`);
  }
}

main().catch((e) => {
  console.error("\n  Failed:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
