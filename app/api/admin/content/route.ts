import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

/**
 * Creates a row for the simple title/description/link content tables.
 *
 * The panel signs in with its own cookie session, not a Supabase one, so the
 * browser's anon client has no `auth.uid()` and is rejected by these tables'
 * insert policies. Writes go through the service role here instead — the same
 * shape as /api/admin/delete.
 */
const WRITABLE_TABLES = new Set(["notifications", "loksewa_details"]);

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { table, title, description, link, created_on } = await request
    .json()
    .catch(() => ({}));

  if (!WRITABLE_TABLES.has(table)) {
    return NextResponse.json({ error: "Table not writable" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const { error } = await check.supabase.from(table).insert({
    title: title.trim(),
    description: description.trim(),
    link: typeof link === "string" ? link.trim() : "",
    created_on:
      typeof created_on === "string" && created_on
        ? created_on
        : new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
