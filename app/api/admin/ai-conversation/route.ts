import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/server/admin";

/**
 * Full transcript of a single AI chat conversation, for the user-detail
 * viewer. The user-detail route only ships a capped, newest-first slice of
 * messages across all conversations; this returns one conversation in full and
 * in reading order.
 */
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase: SupabaseClient = check.supabase;
  const { userId, conversationId } = await request.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  if (typeof conversationId !== "string" || !conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Scope the lookup to the owner so one user's id can never pull another
  // user's transcript.
  const { data: conversation, error: convError } = await supabase
    .from("ai_chat_conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // `sources` (grounded-answer citations) and `audio_url` (voice notes) are
  // later-phase columns — select them separately so an older database that
  // lacks them still returns the transcript instead of erroring.
  let messages: any[] = [];
  const full = await supabase
    .from("ai_chat_messages")
    .select("id, content, is_user, created_at, audio_url, sources")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (full.error) {
    const basic = await supabase
      .from("ai_chat_messages")
      .select("id, content, is_user, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (basic.error) {
      return NextResponse.json({ error: basic.error.message }, { status: 500 });
    }
    messages = basic.data ?? [];
  } else {
    messages = full.data ?? [];
  }

  return NextResponse.json({ conversation, messages });
}
