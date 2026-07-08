import { NextResponse } from "next/server";
import { requireAdmin, tableMissing } from "@/lib/server/admin";

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;

  const { data: optIns, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, whatsapp_consent_at, program, semester, district")
    .eq("whatsapp_opt_in", true)
    .order("whatsapp_consent_at", { ascending: false })
    .limit(500);

  if (error) {
    if (tableMissing(error)) return NextResponse.json({ enabled: false, items: [], total: 0, optIns: 0 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: total } = await supabase.from("profiles").select("*", { count: "exact", head: true });

  return NextResponse.json({
    enabled: true,
    total: total ?? 0,
    optIns: optIns?.length ?? 0,
    items: optIns || [],
  });
}
