import { NextResponse } from "next/server";
import { requireAdmin, listAuthUsers, tableMissing } from "@/lib/server/admin";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function tally(rows: any[], key: string): { label: string; value: number }[] {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    const label = String(v);
    m[label] = (m[label] || 0) + 1;
  }
  return Object.entries(m)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;

  // ---- from auth users: signups over 14 days + DAU/WAU/MAU ----
  const { users } = await listAuthUsers({ perPage: 1000 });
  const now = new Date();
  const signups14: { day: string; value: number }[] = [];
  const dayIndex: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const k = dayKey(new Date(now.getTime() - i * 864e5));
    dayIndex[k] = signups14.length;
    signups14.push({ day: k.slice(5), value: 0 });
  }
  let dau = 0,
    wau = 0,
    mau = 0;
  const dayMs = 864e5;
  for (const u of users) {
    if (u.created_at) {
      const k = dayKey(new Date(u.created_at));
      if (k in dayIndex) signups14[dayIndex[k]].value++;
    }
    if (u.last_sign_in_at) {
      const ago = (now.getTime() - new Date(u.last_sign_in_at).getTime()) / dayMs;
      if (ago < 1) dau++;
      if (ago < 7) wau++;
      if (ago < 30) mau++;
    }
  }

  // ---- documents by type (always present) ----
  let documentsByType: { label: string; value: number }[] = [];
  {
    const { data } = await supabase.from("documents").select("doc_type").limit(5000);
    if (data) documentsByType = tally(data, "doc_type");
  }

  // ---- profiles-derived segments (may be absent) ----
  let profilesEnabled = false;
  let byProgram: { label: string; value: number }[] = [];
  let bySemester: { label: string; value: number }[] = [];
  let byDistrict: { label: string; value: number }[] = [];
  let referralSources: { label: string; value: number }[] = [];
  let optInRate = 0;
  let onboardedCount = 0;
  let profilesTotal = 0;
  {
    const { data, error } = await supabase
      .from("profiles")
      .select("program, faculty, semester, district, referral_source, whatsapp_opt_in, onboarded_at")
      .limit(10000);
    if (!error && data) {
      profilesEnabled = true;
      profilesTotal = data.length;
      byProgram = tally(data, "program");
      bySemester = tally(data, "semester").sort((a, b) => Number(a.label) - Number(b.label));
      byDistrict = tally(data, "district").slice(0, 8);
      referralSources = tally(data, "referral_source");
      const opt = data.filter((r) => r.whatsapp_opt_in).length;
      optInRate = data.length ? Math.round((opt / data.length) * 100) : 0;
      onboardedCount = data.filter((r) => r.onboarded_at).length;
    } else if (error && !tableMissing(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ---- event-derived funnel + top content (may be absent) ----
  let eventsEnabled = false;
  let funnel: { label: string; value: number }[] = [];
  let topContent: { label: string; value: number }[] = [];
  {
    // Probe once with a non-HEAD request so a missing table surfaces its error
    // (HEAD count requests don't populate the error object in supabase-js).
    const probe = await supabase.from("analytics_events").select("id").limit(1);
    eventsEnabled = !probe.error;
    if (probe.error && !tableMissing(probe.error)) {
      return NextResponse.json({ error: probe.error.message }, { status: 500 });
    }

    if (eventsEnabled) {
      const funnelSteps = [
        { key: "onboarding_start", label: "Started onboarding" },
        { key: "onboarding_step", label: "Answered a step" },
        { key: "whatsapp_optin", label: "WhatsApp opt-in" },
        { key: "onboarding_complete", label: "Completed onboarding" },
      ];
      const counts = await Promise.all(
        funnelSteps.map(async (s) => {
          const { count } = await supabase
            .from("analytics_events")
            .select("*", { count: "exact", head: true })
            .eq("event_name", s.key);
          return { label: s.label, value: count ?? 0 };
        })
      );
      funnel = counts;
    }

    if (eventsEnabled) {
      const { data } = await supabase
        .from("analytics_events")
        .select("properties")
        .eq("event_name", "download")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (data) {
        const m: Record<string, number> = {};
        for (const r of data) {
          const title = r.properties?.title || r.properties?.document_id;
          if (!title) continue;
          m[String(title)] = (m[String(title)] || 0) + 1;
        }
        topContent = Object.entries(m)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);
      }
    }
  }

  return NextResponse.json({
    usersTotal: users.length,
    dau,
    wau,
    mau,
    signups14,
    documentsByType,
    profiles: {
      enabled: profilesEnabled,
      total: profilesTotal,
      optInRate,
      onboardedCount,
      byProgram,
      bySemester,
      byDistrict,
      referralSources,
    },
    events: { enabled: eventsEnabled, funnel, topContent },
  });
}
