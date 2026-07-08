import { NextResponse } from "next/server";
import { requireAdmin, safeCount, listAuthUsers } from "@/lib/server/admin";

interface Activity {
  type: string;
  title: string;
  subtitle: string;
  at: string;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;

  const [{ users, total: usersTotal }, documents, notifications, loksewa, feedback, adsDisabled, whatsappOptIns] =
    await Promise.all([
      listAuthUsers({ perPage: 1000 }),
      safeCount(supabase, "documents"),
      safeCount(supabase, "notifications"),
      safeCount(supabase, "loksewa_details"),
      safeCount(supabase, "feedbacks"),
      safeCount(supabase, "ads_control", { ads_enabled: false }),
      safeCount(supabase, "profiles", { whatsapp_opt_in: true }),
    ]);

  // Active today / signups this week, derived from the auth user list.
  const now = new Date();
  const todayKey = dayKey(now);
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  let activeToday = 0;
  let signupsThisWeek = 0;
  const signupsByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    signupsByDay[dayKey(new Date(now.getTime() - i * 864e5))] = 0;
  }
  for (const u of users) {
    if (u.last_sign_in_at && dayKey(new Date(u.last_sign_in_at)) === todayKey) activeToday++;
    if (u.created_at) {
      const created = new Date(u.created_at);
      if (created >= weekAgo) signupsThisWeek++;
      const k = dayKey(created);
      if (k in signupsByDay) signupsByDay[k]++;
    }
  }

  // Recent activity — a few rows from each source, merged newest-first.
  const activity: Activity[] = [];
  const pushRows = async (
    table: string,
    order: string,
    map: (r: any) => Activity
  ) => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: false })
      .limit(5);
    if (!error && data) data.forEach((r) => activity.push(map(r)));
  };

  await Promise.all([
    pushRows("documents", "created_at", (r) => ({
      type: "document",
      title: r.title || "Document",
      subtitle: [r.doc_type, r.period_unit !== "none" ? `${r.period_unit} ${r.period ?? ""}`.trim() : null]
        .filter(Boolean)
        .join(" · "),
      at: r.created_at,
    })),
    pushRows("notifications", "created_on", (r) => ({
      type: "notification",
      title: r.title || "Notification",
      subtitle: r.description || "",
      at: r.created_on,
    })),
    pushRows("feedbacks", "created_at", (r) => ({
      type: "feedback",
      title: `Feedback from ${r.name || r.email || "user"}`,
      subtitle: r.feedback || "",
      at: r.created_at,
    })),
  ]);

  // Newest users as activity too.
  users
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 3)
    .forEach((u) =>
      activity.push({
        type: "user",
        title: u.full_name || u.email,
        subtitle: `signed up via ${u.provider}`,
        at: u.created_at,
      })
    );

  activity.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  return NextResponse.json({
    counts: {
      users: usersTotal,
      documents,
      notifications,
      loksewa,
      feedback,
      adsDisabled,
      whatsappOptIns, // null when profiles table absent
      activeToday,
      signupsThisWeek,
    },
    signupsByDay,
    activity: activity.slice(0, 10),
  });
}
