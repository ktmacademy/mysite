import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, getAuthUser } from "@/lib/server/admin";

/** Runs a select, returning rows or [] (also on a missing table). */
async function rows<T = any>(qb: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await qb;
  if (error) return [];
  return (data ?? []) as T[];
}
async function one<T = any>(qb: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data, error } = await qb;
  if (error) return null;
  return data ?? null;
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase: SupabaseClient = check.supabase;
  const { userId } = await request.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const authUser = await getAuthUser(userId);
  if (!authUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch the independent per-user tables in parallel.
  const [
    profile,
    events,
    support,
    aiConversations,
    bookmarks,
    quiz,
    userCourses,
    aiKeys,
    folders,
    folderItems,
    progress,
    chats,
    feedback,
  ] = await Promise.all([
    one(supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle()),
    rows(
      supabase
        .from("analytics_events")
        .select("event_name, properties, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500)
    ),
    rows(
      supabase
        .from("support_messages")
        .select("id, sender, body, audio_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
    ),
    rows(
      supabase
        .from("ai_chat_conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
    ),
    rows(
      supabase
        .from("bookmarks")
        .select("item_type, item_title, item_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
    ),
    rows(
      supabase
        .from("quiz_results")
        .select("category, score, total, completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
    ),
    rows(
      supabase
        .from("user_courses")
        .select("title, link, created_on")
        .eq("user_id", userId)
        .order("created_on", { ascending: false })
    ),
    rows(
      supabase
        .from("user_ai_keys")
        .select("api_key, model, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
    ),
    rows(
      supabase
        .from("user_folders")
        .select("id, name, color, created_on")
        .eq("user_id", userId)
        .order("created_on", { ascending: false })
    ),
    rows(supabase.from("user_folder_items").select("folder_id, kind").eq("user_id", userId)),
    rows(
      supabase
        .from("user_course_progress")
        .select("video_id, completed, updated_at")
        .eq("user_id", userId)
    ),
    rows(
      supabase
        .from("chats")
        .select("message, uploaded_image_url, time")
        .eq("user_id", userId)
        .order("time", { ascending: false })
        .limit(50)
    ),
    rows(
      supabase
        .from("feedbacks")
        .select("feedback, created_at")
        .eq("email", authUser.email)
    ),
  ]);

  // AI messages for this user's conversations.
  const convIds = (aiConversations as any[]).map((c) => c.id);
  const aiMessages = convIds.length
    ? await rows(
        supabase
          .from("ai_chat_messages")
          .select("conversation_id, content, is_user, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
          .limit(400)
      )
    : [];

  // Event tally + recent slice.
  const eventCounts: Record<string, number> = {};
  for (const e of events as any[]) {
    const n = e.event_name || "unknown";
    eventCounts[n] = (eventCounts[n] || 0) + 1;
  }
  const eventSummary = Object.entries(eventCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Folder-item counts per folder.
  const itemsByFolder: Record<string, number> = {};
  for (const it of folderItems as any[]) {
    itemsByFolder[it.folder_id] = (itemsByFolder[it.folder_id] || 0) + 1;
  }
  const foldersWithCounts = (folders as any[]).map((f) => ({
    ...f,
    itemCount: itemsByFolder[f.id] || 0,
  }));

  return NextResponse.json({
    user: authUser,
    profile,
    activity: {
      totalEvents: (events as any[]).length,
      summary: eventSummary,
      recent: (events as any[]).slice(0, 40),
    },
    support,
    ai: {
      conversations: aiConversations,
      messages: aiMessages,
      messageCount: (aiMessages as any[]).length,
    },
    bookmarks,
    quiz,
    courses: userCourses,
    // The user's own Gemini keys, newest first. Sent whole so an admin can
    // check which key an account is actually using when its AI chat fails;
    // the UI masks them until explicitly revealed.
    aiKeys,
    folders: foldersWithCounts,
    progress: {
      total: (progress as any[]).length,
      completed: (progress as any[]).filter((p) => p.completed).length,
      items: (progress as any[]).slice(0, 50),
    },
    chats,
    feedback,
  });
}
