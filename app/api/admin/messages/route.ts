import { NextResponse } from "next/server";
import { requireAdmin, tableMissing, listAuthUsers } from "@/lib/server/admin";
import { sendPush } from "@/lib/server/push";

interface MessageRow {
  id: number;
  user_id: string;
  sender: string;
  body: string | null;
  audio_url: string | null;
  read_by_admin: boolean;
  created_at: string;
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "threads";

  // ---- reply: insert an admin message into a user's thread ----
  if (action === "reply") {
    const { userId, text } = body;
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    const { error } = await supabase.from("support_messages").insert({
      user_id: userId,
      sender: "admin",
      body: text.trim(),
    });
    if (error) {
      if (tableMissing(error)) return NextResponse.json({ enabled: false });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Best-effort push to the user's devices. A push failure must not fail the
    // reply itself — the message is already saved and will show in-app.
    const push = await sendPush({
      userIds: [userId],
      title: "New reply from CTEVT Plus",
      body: text.trim().slice(0, 140),
      data: { type: "support_reply" },
    });
    return NextResponse.json({ ok: true, pushed: push.ok });
  }

  // ---- thread: one user's full conversation (and mark their msgs read) ----
  if (action === "thread") {
    const { userId } = body;
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("support_messages")
      .select("id, user_id, sender, body, audio_url, read_by_admin, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) {
      if (tableMissing(error)) return NextResponse.json({ enabled: false, messages: [] });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Mark the user's messages as read.
    await supabase
      .from("support_messages")
      .update({ read_by_admin: true })
      .eq("user_id", userId)
      .eq("sender", "user")
      .eq("read_by_admin", false);
    return NextResponse.json({ enabled: true, messages: data || [] });
  }

  // ---- threads: one row per user who has messaged, newest first ----
  const { data, error } = await supabase
    .from("support_messages")
    .select("id, user_id, sender, body, audio_url, read_by_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    if (tableMissing(error)) return NextResponse.json({ enabled: false, threads: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as MessageRow[];
  const { users } = await listAuthUsers({ perPage: 1000 });
  const emailById: Record<string, string> = {};
  for (const u of users) emailById[u.id] = u.email;

  const byUser = new Map<
    string,
    { userId: string; email: string; last: MessageRow; unread: number }
  >();
  for (const r of rows) {
    const existing = byUser.get(r.user_id);
    if (!existing) {
      byUser.set(r.user_id, {
        userId: r.user_id,
        email: emailById[r.user_id] || "unknown",
        last: r, // rows are newest-first, so the first seen is the latest
        unread: 0,
      });
    }
    if (r.sender === "user" && !r.read_by_admin) {
      byUser.get(r.user_id)!.unread++;
    }
  }

  const threads = [...byUser.values()].map((t) => ({
    userId: t.userId,
    email: t.email,
    unread: t.unread,
    lastAt: t.last.created_at,
    preview: t.last.audio_url ? "🎤 Voice message" : t.last.body || "",
    lastSender: t.last.sender,
  }));

  return NextResponse.json({ enabled: true, threads });
}
