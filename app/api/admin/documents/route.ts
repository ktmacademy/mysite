import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/server/admin";

const DOCUMENT_BUCKETS = new Set(["notes", "pyqs", "solutions"]);
const DOC_TYPES = new Set(["notes", "pyqs", "solutions"]);
const PERIOD_UNITS = new Set(["semester", "year", "none"]);

async function getOrCreate(
  supabase: SupabaseClient,
  table: "programs" | "faculties" | "courses",
  match: Record<string, string>,
  insert: Record<string, string>
): Promise<string> {
  let query = supabase.from(table).select("id");
  for (const [k, v] of Object.entries(match)) query = query.eq(k, v);
  const { data: existing, error: selError } = await query.maybeSingle();
  if (selError) throw new Error(`${table} lookup failed: ${selError.message}`);
  if (existing) return existing.id;

  const { data: created, error: insError } = await supabase
    .from(table)
    .insert(insert)
    .select("id")
    .single();
  if (insError || !created) {
    throw new Error(`${table} insert failed: ${insError?.message}`);
  }
  return created.id;
}

/**
 * Records an uploaded document: ensures program/faculty/course rows exist,
 * then inserts the documents row pointing at the storage public URL.
 */
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json().catch(() => ({}));
  const { program, faculty, course, title, docType, periodUnit, bucket, path } = body;
  const period = body.period;

  for (const [name, value] of Object.entries({ program, faculty, course, title })) {
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: `Missing ${name}` }, { status: 400 });
    }
  }
  if (!DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
  }
  if (!PERIOD_UNITS.has(periodUnit)) {
    return NextResponse.json({ error: "Invalid periodUnit" }, { status: 400 });
  }
  if (periodUnit !== "none" && (!Number.isInteger(period) || period < 1 || period > 12)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  if (!DOCUMENT_BUCKETS.has(bucket) || typeof path !== "string" || !path) {
    return NextResponse.json({ error: "Invalid bucket/path" }, { status: 400 });
  }

  const supabase = check.supabase;

  try {
    const programId = await getOrCreate(
      supabase,
      "programs",
      { name: program.trim() },
      { name: program.trim() }
    );
    const facultyId = await getOrCreate(
      supabase,
      "faculties",
      { program_id: programId, name: faculty.trim() },
      { program_id: programId, name: faculty.trim() }
    );
    const courseId = await getOrCreate(
      supabase,
      "courses",
      { faculty_id: facultyId, name: course.trim() },
      { faculty_id: facultyId, name: course.trim() }
    );

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        course_id: courseId,
        doc_type: docType,
        title: title.trim(),
        link: pub.publicUrl,
        period_unit: periodUnit,
        period: periodUnit === "none" ? null : period,
      })
      .select("id")
      .single();
    if (error || !doc) {
      throw new Error(`documents insert failed: ${error?.message}`);
    }

    return NextResponse.json({ ok: true, id: doc.id, link: pub.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
