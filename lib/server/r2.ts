import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 is S3-compatible. These come from an R2 API token
 * (Account ID + Access Key + Secret) plus the target bucket and the bucket's
 * public base URL (the pub-<hash>.r2.dev domain or a custom domain).
 *
 * Required env (server-only):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * Optional:
 *   R2_PUBLIC_BASE  (defaults to the project's existing pub-… dev domain)
 */
export const R2_BUCKET = process.env.R2_BUCKET || "";
export const R2_PUBLIC_BASE = (
  process.env.R2_PUBLIC_BASE ||
  "https://pub-af803d264eb44f84bc7687093b78fdca.r2.dev"
).replace(/\/+$/, "");

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      R2_BUCKET
  );
}

let client: S3Client | null = null;

export function r2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/**
 * Public URL for an object key stored in the R2 bucket. Each path segment is
 * URL-encoded so legacy keys with spaces, `&`, `()` etc. produce a valid URL
 * (slashes are preserved as separators).
 */
export function r2PublicUrl(key: string): string {
  const path = key
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${R2_PUBLIC_BASE}/${path}`;
}
