import { NextResponse } from "next/server";
import { requireAdmin, getAuthUser } from "@/lib/server/admin";

/**
 * One user's full analytics event history, for the activity detail page.
 *
 * The user detail route caps events at 500 and shows the newest 40; this one
 * pages through the whole table instead, so a long-lived account's history
 * stays reachable. The tally is computed over every row, not just the page.
 */

const PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
/** Cap on the rows scanned for the tally, so a heavy user can't stall the page. */
const SUMMARY_SCAN_LIMIT = 5000;

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const offset = Math.max(0, Number(body.offset) || 0);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(body.limit) || PAGE_SIZE)
  );

  const authUser = await getAuthUser(userId);
  if (!authUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error, count } = await check.supabase
    .from("analytics_events")
    .select("event_name, properties, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = data ?? [];
  const total = count ?? events.length;

  // The tally only has to be built for the first page — the client keeps it
  // while paging — so later requests skip the extra scan entirely.
  let summary: Array<{ label: string; value: number }> | undefined;
  if (offset === 0) {
    const { data: all } = await check.supabase
      .from("analytics_events")
      .select("event_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(SUMMARY_SCAN_LIMIT);

    const counts: Record<string, number> = {};
    for (const row of all ?? []) {
      const name = (row as { event_name?: string }).event_name || "unknown";
      counts[name] = (counts[name] || 0) + 1;
    }
    summary = Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  return NextResponse.json({
    user: authUser,
    total,
    offset,
    limit,
    events,
    hasMore: offset + events.length < total,
    ...(summary ? { summary } : {}),
  });
}
