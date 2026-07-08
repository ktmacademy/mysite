import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

const DELETABLE_TABLES = new Set([
  "notifications",
  "loksewa_details",
  "documents",
  "feedbacks",
  "broadcasts",
  "carousel_images",
]);

const DOCUMENT_BUCKETS = new Set(["notes", "pyqs", "solutions"]);

/** Extracts {bucket, path} from a Supabase public storage URL. */
function parseStorageLink(link: string): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/public/";
  const idx = link.indexOf(marker);
  if (idx === -1) return null;
  const rest = link.slice(idx + marker.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent(rest.slice(slash + 1));
  if (!DOCUMENT_BUCKETS.has(bucket) || !path) return null;
  return { bucket, path };
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { table, id } = await request.json().catch(() => ({}));
  if (!DELETABLE_TABLES.has(table)) {
    return NextResponse.json({ error: "Table not deletable" }, { status: 400 });
  }
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = check.supabase;

  // For documents, remove the uploaded file from storage first.
  if (table === "documents") {
    const { data: row } = await supabase
      .from("documents")
      .select("link")
      .eq("id", id)
      .maybeSingle();
    const parsed = row?.link ? parseStorageLink(row.link) : null;
    if (parsed) {
      await supabase.storage.from(parsed.bucket).remove([parsed.path]);
    }
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
