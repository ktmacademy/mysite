import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

const TABLE = "carousel_images";
const TYPES = new Set(["image", "course_playlist", "course_video"]);

/** Create a carousel slide. Body validated per slide_type. */
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json().catch(() => ({}));

  // The client's toggle/reorder actions POST { id, is_active?/sort_order? }
  // (adminFetch only does POST). Treat a body carrying an id as an update so
  // those work without a separate PATCH request.
  if (body.id) {
    return updateSlide(check.supabase, body);
  }

  const slideType = String(body.slide_type || "image");
  if (!TYPES.has(slideType)) {
    return NextResponse.json({ error: "Invalid slide type" }, { status: 400 });
  }

  const imageUrl = (body.image_url ?? "").toString().trim();
  const courseId = body.course_id ? String(body.course_id) : null;
  const link = (body.link ?? "").toString().trim();
  const title = (body.title ?? "").toString().trim();

  if (slideType === "image") {
    if (!imageUrl) {
      return NextResponse.json(
        { error: "An image URL is required for image slides" },
        { status: 400 }
      );
    }
  } else {
    if (!courseId) {
      return NextResponse.json(
        { error: "Select a course for this slide" },
        { status: 400 }
      );
    }
    if (!link) {
      return NextResponse.json(
        { error: "A playlist/video link is required for course slides" },
        { status: 400 }
      );
    }
  }

  // Append to the end of the current order unless one is supplied.
  let sortOrder = Number(body.sort_order);
  if (!Number.isFinite(sortOrder)) {
    const { data: last } = await check.supabase
      .from(TABLE)
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = ((last?.sort_order as number | undefined) ?? -1) + 1;
  }

  const { error } = await check.supabase.from(TABLE).insert({
    slide_type: slideType,
    image_url: imageUrl || null,
    course_id: slideType === "image" ? null : courseId,
    // Image slides may carry an optional external URL (opened outside the app
    // on tap); course slides always store their playlist/video link.
    link: slideType === "image" ? link || null : link,
    title: title || null,
    sort_order: sortOrder,
    is_active: body.is_active === false ? false : true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Update mutable fields of a slide: is_active and sort_order. */
export async function PATCH(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const body = await request.json().catch(() => ({}));
  return updateSlide(check.supabase, body);
}

/** Shared update path for is_active / sort_order, used by POST(id) and PATCH. */
async function updateSlide(
  supabase: any,
  body: Record<string, any>
): Promise<Response> {
  const id = body.id ? String(body.id) : "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (Number.isFinite(Number(body.sort_order))) {
    patch.sort_order = Number(body.sort_order);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
