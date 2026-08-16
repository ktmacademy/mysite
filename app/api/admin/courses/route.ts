import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { canonicalPlaylistUrl, fetchYoutubeMeta } from "@/lib/youtube";

const TABLE = "youtube_courses";

/** Courses shown in the app's Courses section, in display order. */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data, error } = await check.supabase
    .from(TABLE)
    .select("id, title, description, link, sort_order, created_on")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ courses: data ?? [] });
}

/**
 * Creates a course from a YouTube playlist link, updates one, or previews a
 * link's metadata.
 *
 * The client helper only speaks POST (see lib/admin-api), so the action is
 * inferred from the body: `action: "preview"` looks a link up without writing,
 * a body carrying an `id` updates that row, and anything else inserts.
 */
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json().catch(() => ({}));

  if (body.action === "preview") {
    return previewLink(body.link);
  }
  if (body.id) {
    return updateCourse(check.supabase, body);
  }

  const playlistUrl = canonicalPlaylistUrl(String(body.link ?? ""));
  if (!playlistUrl) {
    return NextResponse.json(
      { error: "Paste a YouTube playlist link (one containing ?list=…)" },
      { status: 400 }
    );
  }

  // The admin's own wording wins; oEmbed only fills what was left blank.
  let title = String(body.title ?? "").trim();
  let description = String(body.description ?? "").trim();
  if (!title || !description) {
    const meta = await fetchYoutubeMeta(playlistUrl);
    if (!title) title = meta?.title?.trim() ?? "";
    if (!description && meta?.author) {
      description = `YouTube playlist by ${meta.author}.`;
    }
  }
  if (!title) {
    return NextResponse.json(
      { error: "Could not read the playlist title — enter one manually." },
      { status: 400 }
    );
  }

  // Adding the same playlist twice would show a duplicate card in the app.
  const { data: existing } = await check.supabase
    .from(TABLE)
    .select("id")
    .eq("link", playlistUrl)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "That playlist is already in the courses list." },
      { status: 409 }
    );
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
    title,
    description,
    link: playlistUrl,
    sort_order: sortOrder,
    created_on: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, title, description, link: playlistUrl });
}

/** Update a course's title, description, link or position. */
export async function PATCH(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const body = await request.json().catch(() => ({}));
  return updateCourse(check.supabase, body);
}

/** Looks a playlist link up without writing, so the form can prefill itself. */
async function previewLink(rawLink: unknown): Promise<Response> {
  const playlistUrl = canonicalPlaylistUrl(String(rawLink ?? ""));
  if (!playlistUrl) {
    return NextResponse.json(
      { error: "Paste a YouTube playlist link (one containing ?list=…)" },
      { status: 400 }
    );
  }
  const meta = await fetchYoutubeMeta(playlistUrl);
  if (!meta) {
    return NextResponse.json(
      { error: "YouTube did not return details for that playlist. Is it public?" },
      { status: 404 }
    );
  }
  return NextResponse.json({
    link: playlistUrl,
    title: meta.title,
    description: meta.author ? `YouTube playlist by ${meta.author}.` : "",
    thumbnail: meta.thumbnail,
  });
}

/** Shared update path, used by POST(id) and PATCH. */
async function updateCourse(
  supabase: any,
  body: Record<string, any>
): Promise<Response> {
  const id = body.id ? String(body.id) : "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    patch.description = body.description.trim();
  }
  if (typeof body.link === "string" && body.link.trim()) {
    const playlistUrl = canonicalPlaylistUrl(body.link);
    if (!playlistUrl) {
      return NextResponse.json(
        { error: "Paste a YouTube playlist link (one containing ?list=…)" },
        { status: 400 }
      );
    }
    patch.link = playlistUrl;
  }
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
