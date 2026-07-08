import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

const DOCUMENT_BUCKETS = new Set(["notes", "pyqs", "solutions"]);

/** Keeps folder structure but strips characters that break storage keys. */
function sanitizePath(path: string): string {
  return path
    .split("/")
    .map((seg) => seg.trim().replace(/[^a-zA-Z0-9 _.()-]/g, "").replace(/\s+/g, "_"))
    .filter(Boolean)
    .join("/");
}

/**
 * Returns a signed upload URL so the browser can upload the PDF directly to
 * Supabase Storage (avoids Vercel's request body size limit).
 */
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { bucket, path } = await request.json().catch(() => ({}));
  if (!DOCUMENT_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const cleanPath = sanitizePath(path);
  const { data, error } = await check.supabase.storage
    .from(bucket)
    .createSignedUploadUrl(cleanPath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not create upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
