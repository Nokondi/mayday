import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env.js';

export const s3Client = new S3Client({
  endpoint: env.SPACES_ENDPOINT,
  region: env.SPACES_REGION,
  credentials: {
    accessKeyId: env.SPACES_KEY,
    secretAccessKey: env.SPACES_SECRET,
  },
});

/** Extract the object key from a Spaces URL. */
export function getKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Strip leading slash; pathname includes the bucket name when using
    // path-style URLs, but multer-s3 defaults to virtual-hosted style
    // (bucket is the subdomain), so the pathname is just the key.
    return parsed.pathname.replace(/^\//, '') || null;
  } catch {
    return null;
  }
}

/** Delete an object from Spaces by its public URL. No-op if URL is invalid. */
export async function deleteObjectByUrl(url: string): Promise<void> {
  const key = getKeyFromUrl(url);
  if (!key) return;
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.SPACES_BUCKET,
      Key: key,
    }),
  );
}
