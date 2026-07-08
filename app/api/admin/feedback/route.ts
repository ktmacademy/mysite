import { NextResponse } from "next/server";
import { requireAdmin, tableMissing } from "@/lib/server/admin";

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  // feedbacks has no SELECT policy for app users — read it via the service role.
  const { data, error } = await check.supabase
    .from("feedbacks")
    .select("id, name, email, feedback, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (tableMissing(error)) return NextResponse.json({ enabled: false, items: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ enabled: true, items: data || [] });
}
