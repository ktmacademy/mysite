import { NextResponse } from "next/server";
import { requireAdmin, tableMissing, listAuthUsers } from "@/lib/server/admin";

/**
 * Lists student voice messages (ai_chat_messages rows that have an audio_url)
 * across all users. Service-role, because RLS restricts ai_chat_messages to
 * their owner. Degrades to `available: false` when the audio_url column or the
 * table isn't there yet.
 */
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;

  const { data: msgs, error } = await supabase
    .from("ai_chat_messages")
    .select("id, conversation_id, content, audio_url, created_at")
    .not("audio_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (
      tableMissing(error) ||
      /audio_url|column .* does not exist|42703/i.test(error.message || "")
    ) {
      return NextResponse.json({ available: false, messages: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = msgs || [];
  const convIds = [...new Set(rows.map((m) => m.conversation_id))];
  const convById: Record<string, { user_id: string; title: string }> = {};
  if (convIds.length) {
    const { data: convs } = await supabase
      .from("ai_chat_conversations")
      .select("id, user_id, title")
      .in("id", convIds);
    for (const c of convs || []) {
      convById[c.id] = { user_id: c.user_id, title: c.title };
    }
  }

  const emailById: Record<string, string> = {};
  try {
    const { users } = await listAuthUsers({ perPage: 1000 });
    for (const u of users) emailById[u.id] = u.email;
  } catch {
    // Non-fatal: emails just show as "—".
  }

  const messages = rows.map((m) => {
    const conv = convById[m.conversation_id];
    return {
      id: m.id,
      transcript: m.content,
      audio_url: m.audio_url,
      created_at: m.created_at,
      conversation_title: conv?.title ?? null,
      user_email: conv ? emailById[conv.user_id] ?? null : null,
    };
  });

  return NextResponse.json({ available: true, messages });
}
