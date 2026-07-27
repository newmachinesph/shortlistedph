import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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

/**
 * Presigns a PUT whose length is fixed by the signature, not by trust.
 *
 * `contentLength` is mandatory because it is the only thing standing between a
 * signed-in account and a 10 GB body on a CDN-public prefix: every caller used
 * to validate a client-declared size in application code and then sign a bare
 * PutObjectCommand, which carries no length condition at all. SigV4 signs the
 * content-length header, so the body must be exactly this many bytes or the
 * signature does not verify and R2 rejects the request.
 *
 * ContentType deliberately gets no such promise — the S3 presigner adds
 * content-type to its unsignable set, so it labels the object without
 * constraining it. The confirm step is where the stored object is checked.
 */
export async function presignUpload(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 300,
) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn },
  );
}

/**
 * What was actually stored, or null when nothing was. Confirm steps must not
 * point a URL at an object they never looked at: a presigned URL that is never
 * used leaves `User.image` aimed at a 404, and content-type is client-supplied.
 */
export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch (e) {
    // Only "it isn't there" is an answer. Credentials or network trouble must
    // surface as a 500, never as a silent "the upload didn't happen".
    if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw e;
  }
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
