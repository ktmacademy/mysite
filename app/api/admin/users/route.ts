import { NextResponse } from "next/server";
import { requireAdmin, listAuthUsers, tableMissing } from "@/lib/server/admin";

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;
  const { search } = await request.json().catch(() => ({}));

  const { users, total } = await listAuthUsers({ perPage: 1000 });

  // Enrich with profile rows when the profiles table exists.
  let profilesEnabled = false;
  const byId: Record<string, any> = {};
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, whatsapp_opt_in, program, faculty, semester, district, last_active_at");
  if (!error && profiles) {
    profilesEnabled = true;
    for (const p of profiles) byId[p.user_id] = p;
  } else if (error && !tableMissing(error)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count each user's own YouTube courses (the "Add your own course" sheet in
  // the app). One query for everyone rather than a count per row: the table is
  // small and per-user counts would be N round trips for a 1000-user page.
  const courseCounts: Record<string, number> = {};
  const { data: userCourses, error: coursesError } = await supabase
    .from("user_courses")
    .select("user_id");
  if (coursesError && !tableMissing(coursesError)) {
    return NextResponse.json({ error: coursesError.message }, { status: 500 });
  }
  for (const c of userCourses ?? []) {
    courseCounts[c.user_id] = (courseCounts[c.user_id] || 0) + 1;
  }

  let rows = users.map((u) => {
    const p = byId[u.id] || {};
    return {
      id: u.id,
      email: u.email,
      name: p.full_name || u.full_name || null,
      avatar_url: u.avatar_url,
      provider: u.provider,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      phone: p.phone ?? null,
      whatsapp_opt_in: p.whatsapp_opt_in ?? null,
      program: p.program ?? null,
      faculty: p.faculty ?? null,
      semester: p.semester ?? null,
      district: p.district ?? null,
      course_count: courseCounts[u.id] ?? 0,
    };
  });

  if (typeof search === "string" && search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.program || "").toLowerCase().includes(q) ||
        (r.phone || "").includes(q)
    );
  }

  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  return NextResponse.json({ total, profilesEnabled, users: rows });
}
