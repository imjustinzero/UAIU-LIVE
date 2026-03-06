import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, statSync } from "fs";

const BACKUP_PREFIX = "uaiu-backups/";

export interface S3ObjectMeta {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

export interface S3HeadResult {
  size: number;
  etag: string;
}

export interface S3ValidationResult {
  ok: boolean;
  bucket: string | null;
  code?: string;
  detail?: string;
  message?: string;
}

export function isS3Configured(): boolean {
  return !!(
    process.env.S3_BACKUP_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

export function getS3Client(): S3Client | null {
  const bucket = process.env.S3_BACKUP_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = (process.env.AWS_REGION || "us-east-1").toLowerCase().trim();
  const rawEndpoint = process.env.S3_BACKUP_ENDPOINT;
  // Strip trailing slash — AWS Signature V4 signing is sensitive to this
  const endpoint = rawEndpoint ? rawEndpoint.replace(/\/+$/, "") : undefined;

  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: true,
        }
      : {}),
  });
}

export function getS3BucketName(): string | null {
  return process.env.S3_BACKUP_BUCKET || null;
}

/**
 * Upload a local file to S3 under the backup prefix.
 * Uses multipart upload via @aws-sdk/lib-storage for large files.
 */
export async function uploadToS3(
  localPath: string,
  filename: string
): Promise<{ etag: string; key: string; versionId?: string }> {
  const client = getS3Client();
  const bucket = getS3BucketName();
  if (!client || !bucket) {
    throw new Error("S3 not configured — set S3_BACKUP_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
  }

  const key = `${BACKUP_PREFIX}${filename}`;
  const fileStream = createReadStream(localPath);
  const fileSize = statSync(localPath).size;

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: "application/octet-stream",
      ContentLength: fileSize,
      Metadata: {
        "x-uaiu-source": "backup",
        "x-uaiu-filename": filename,
      },
    },
  });

  const result = await upload.done();
  return {
    key,
    etag: (result as any).ETag?.replace(/"/g, "") || "",
    versionId: (result as any).VersionId,
  };
}

export function classifyS3Error(err: any): { code: string; detail: string; message: string } {
  const code = String(err?.Code || err?.code || err?.name || "unknown");
  const status = err?.$metadata?.httpStatusCode;
  const detail = status ? `HTTP ${status}` : "";
  const message = String(err?.message || "Unknown S3 error");
  return { code, detail, message };
}

/**
 * Validate S3 connectivity/authorization for the configured bucket.
 */
export async function validateS3Access(): Promise<S3ValidationResult> {
  const client = getS3Client();
  const bucket = getS3BucketName();
  if (!client || !bucket) {
    return {
      ok: false,
      bucket,
      code: "NotConfigured",
      message: "S3 not configured — set S3_BACKUP_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    };
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, bucket };
  } catch (err: any) {
    const parsed = classifyS3Error(err);
    return {
      ok: false,
      bucket,
      ...parsed,
    };
  }
}

/**
 * List all backup objects in the S3 bucket, sorted newest first.
 */
export async function listS3Backups(): Promise<S3ObjectMeta[]> {
  const client = getS3Client();
  const bucket = getS3BucketName();
  if (!client || !bucket) return [];

  const results: S3ObjectMeta[] = [];
  let continuationToken: string | undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: BACKUP_PREFIX,
      ContinuationToken: continuationToken,
    });
    const resp = await client.send(cmd);
    for (const obj of resp.Contents || []) {
      if (obj.Key && obj.Size !== undefined && obj.LastModified) {
        results.push({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          etag: obj.ETag?.replace(/"/g, ""),
        });
      }
    }
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  return results.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

/**
 * Check if an S3 object exists and return its metadata.
 * Returns null if the object does not exist.
 */
export async function headS3Object(key: string): Promise<S3HeadResult | null> {
  const client = getS3Client();
  const bucket = getS3BucketName();
  if (!client || !bucket) return null;

  try {
    const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
    const resp = await client.send(cmd);
    return {
      size: resp.ContentLength || 0,
      etag: (resp.ETag || "").replace(/"/g, ""),
    };
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete a single S3 object by key.
 */
export async function deleteS3Object(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getS3BucketName();
  if (!client || !bucket) return;

  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(cmd);
}

/**
 * Prune old S3 backups, keeping only the most recent `keep` objects.
 * Returns the list of deleted keys.
 */
export async function pruneS3Backups(keep: number): Promise<string[]> {
  const all = await listS3Backups();
  const toDelete = all.slice(keep);
  const deleted: string[] = [];

  for (const obj of toDelete) {
    try {
      await deleteS3Object(obj.key);
      deleted.push(obj.key);
      console.log(`[Backup S3] Pruned old remote backup: ${obj.key}`);
    } catch (err: any) {
      console.warn(`[Backup S3] Could not prune ${obj.key}:`, err.message);
    }
  }

  return deleted;
}
