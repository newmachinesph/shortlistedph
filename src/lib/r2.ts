import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "./api";

let client: S3Client | null = null;

function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

const bucket = () => requireEnv("R2_BUCKET");

/** Public CDN URL for an object key (e.g. avatars stored on User.image). */
export function publicUrl(key: string): string {
  return `${requireEnv("R2_PUBLIC_URL").replace(/\/$/, "")}/${key}`;
}

/** The bucket's public CDN origin, no trailing slash — used to recognise our own URLs. */
export function publicOrigin(): string {
  return requireEnv("R2_PUBLIC_URL").replace(/\/$/, "");
}

export async function presignUpload(key: string, contentType: string, expiresIn = 300) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export async function presignDownload(key: string, expiresIn = 300) {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
