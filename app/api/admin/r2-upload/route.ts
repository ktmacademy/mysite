import { NextResponse } from "next/server";
import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/lib/server/admin";
import { R2_BUCKET, r2Client, r2Configured, r2PublicUrl } from "@/lib/server/r2";

// Carousel images are small; a single request-body upload stays well under
// Vercel's limit, so we stream the file through the server straight to R2
// (no browser CORS config on the bucket required).
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Where carousel images live in the bucket (the app's existing folder, migrated
// from Firebase). New uploads join the same folder so the picker shows them all.
const CAROUSEL_PREFIX = "carouselSlider/";
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

function slugify(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot === -1 ? name : name.slice(0, dot))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  const ext = (dot === -1 ? "" : name.slice(dot + 1))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ext ? `${base}.${ext}` : base;
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  if (!r2Configured()) {
    return NextResponse.json(
      {
        error:
          "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
          "R2_SECRET_ACCESS_KEY and R2_BUCKET in the environment.",
      },
      { status: 500 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP or GIF images are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 8 MB or smaller" },
      { status: 400 }
    );
  }

  const key = `${CAROUSEL_PREFIX}${Date.now()}-${slugify(file.name || "image")}`;
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload to R2 failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: r2PublicUrl(key), key });
}

/**
 * List the images already stored under `carousel/` in R2 so the admin can pick
 * an existing image instead of re-uploading. Returns newest first.
 */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "R2 is not configured." }, { status: 500 });
  }

  try {
    const images: { key: string; url: string; lastModified: number }[] = [];
    let token: string | undefined;

    // Page through the bucket (R2 caps each response at 1000 keys).
    do {
      const res = await r2Client().send(
        new ListObjectsV2Command({
          Bucket: R2_BUCKET,
          Prefix: CAROUSEL_PREFIX,
          ContinuationToken: token,
        })
      );
      for (const obj of res.Contents ?? []) {
        const key = obj.Key;
        // Skip the folder placeholder and any non-image object.
        if (!key || key.endsWith("/") || !IMAGE_EXT.test(key)) continue;
        images.push({
          key,
          url: r2PublicUrl(key),
          lastModified: obj.LastModified ? obj.LastModified.getTime() : 0,
        });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);

    images.sort((a, b) => b.lastModified - a.lastModified);
    return NextResponse.json({ images });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list R2 images" },
      { status: 500 }
    );
  }
}
