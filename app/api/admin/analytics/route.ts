import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, listAuthUsers, tableMissing } from "@/lib/server/admin";
import { screenLabel } from "@/lib/analytics-events";

/**
 * Everything the analytics dashboard plots, for a caller-chosen window.
 *
 * The window (`days`) applies to the time series, the event-derived panels and
 * the activity rhythms. Catalogue panels (documents) and the profile segments
 * are inventories rather than activity, so they describe the whole table.
 */

type Seg = { label: string; value: number };
type Point = { day: string; value: number };

const DEFAULT_DAYS = 30;
const ALLOWED_DAYS = [7, 14, 30, 90];
const DAY_MS = 864e5;
/** PostgREST caps a response at 1000 rows, so aggregates have to page. */
const PAGE = 1000;
const MAX_EVENT_ROWS = 50_000;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function tally(rows: any[], key: string): Seg[] {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    m[String(v)] = (m[String(v)] || 0) + 1;
  }
  return Object.entries(m)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** A zero-filled day axis, oldest first, so gaps read as zero not as absence. */
function emptySeries(days: number, now: Date): { series: Point[]; index: Record<string, number> } {
  const series: Point[] = [];
  const index: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now.getTime() - i * DAY_MS));
    index[key] = series.length;
    series.push({ day: key, value: 0 });
  }
  return { series, index };
}

/**
 * Reads every analytics_events row since `since`, a page at a time.
 * Returns [] when the table is absent so the dashboard degrades to its
 * profile-only panels rather than erroring.
 */
async function fetchEvents(
  supabase: SupabaseClient,
  since: string
): Promise<{ rows: any[]; enabled: boolean }> {
  const rows: any[] = [];
  for (let from = 0; from < MAX_EVENT_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("event_name, properties, platform, created_at, user_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      // A missing table on the first page means the feature isn't live yet.
      if (from === 0 && tableMissing(error)) return { rows: [], enabled: false };
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows, enabled: true };
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;

  const body = await request.json().catch(() => ({}));
  const days = ALLOWED_DAYS.includes(Number(body.days))
    ? Number(body.days)
    : DEFAULT_DAYS;

  const now = new Date();
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  // ---- auth users: signups, growth, active windows ----
  const { users } = await listAuthUsers({ perPage: 1000 });

  const { series: signups, index: dayIndex } = emptySeries(days, now);
  let dau = 0;
  let wau = 0;
  let mau = 0;
  let signupsBefore = 0; // users created before the window, for the growth line

  for (const u of users) {
    if (u.created_at) {
      const key = dayKey(new Date(u.created_at));
      if (key in dayIndex) signups[dayIndex[key]].value++;
      else if (new Date(u.created_at) < since) signupsBefore++;
    }
    if (u.last_sign_in_at) {
      const ago = (now.getTime() - new Date(u.last_sign_in_at).getTime()) / DAY_MS;
      if (ago < 1) dau++;
      if (ago < 7) wau++;
      if (ago < 30) mau++;
    }
  }

  // Running total across the window — the "are we growing" line.
  let running = signupsBefore;
  const cumulativeUsers: Point[] = signups.map((p) => {
    running += p.value;
    return { day: p.day, value: running };
  });

  // ---- events ----
  const { rows: events, enabled: eventsEnabled } = await fetchEvents(
    supabase,
    sinceIso
  );

  const { series: activeUsers, index: activeIndex } = emptySeries(days, now);
  const activeSets: Array<Set<string>> = activeUsers.map(() => new Set());

  // Three headline event types on one axis, as a stacked-by-day series.
  const engagement = signups.map((p) => ({
    day: p.day,
    app_open: 0,
    screen_view: 0,
    download: 0,
  }));

  const byHour: Seg[] = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, "0"),
    value: 0,
  }));
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byWeekday: Seg[] = weekdayNames.map((label) => ({ label, value: 0 }));

  // Weekday × hour grid — the rhythm the two 1-D charts can only hint at.
  const hourWeekday: number[][] = weekdayNames.map(() => new Array(24).fill(0));

  const screens: Record<string, number> = {};
  const downloadTitles: Record<string, number> = {};
  const downloadTypes: Record<string, number> = {};
  const onboardingSteps: Record<string, number> = {};
  const loginMethods: Record<string, number> = {};
  const eventMix: Record<string, number> = {};

  for (const e of events) {
    const when = new Date(e.created_at);
    const key = dayKey(when);
    const props = (e.properties ?? {}) as Record<string, any>;

    eventMix[e.event_name] = (eventMix[e.event_name] || 0) + 1;
    byHour[when.getHours()].value++;
    byWeekday[when.getDay()].value++;
    hourWeekday[when.getDay()][when.getHours()]++;

    if (key in activeIndex) {
      if (e.user_id) activeSets[activeIndex[key]].add(e.user_id);
      const slot = engagement[activeIndex[key]];
      if (slot && e.event_name in slot) {
        (slot as any)[e.event_name]++;
      }
    }

    switch (e.event_name) {
      case "screen_view":
        if (typeof props.screen === "string") {
          const label = screenLabel(props.screen);
          screens[label] = (screens[label] || 0) + 1;
        }
        break;
      case "download": {
        const title = props.title || props.document_id;
        if (title) {
          downloadTitles[String(title)] = (downloadTitles[String(title)] || 0) + 1;
        }
        if (props.doc_type) {
          downloadTypes[String(props.doc_type)] =
            (downloadTypes[String(props.doc_type)] || 0) + 1;
        }
        break;
      }
      case "onboarding_step":
        if (props.step) {
          onboardingSteps[String(props.step)] =
            (onboardingSteps[String(props.step)] || 0) + 1;
        }
        break;
      case "login":
        if (props.method) {
          loginMethods[String(props.method)] =
            (loginMethods[String(props.method)] || 0) + 1;
        }
        break;
    }
  }

  for (let i = 0; i < activeUsers.length; i++) {
    activeUsers[i].value = activeSets[i].size;
  }

  const toSegs = (m: Record<string, number>, limit?: number): Seg[] => {
    const out = Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    return limit ? out.slice(0, limit) : out;
  };

  // The funnel is ordered by the flow, not by size — it reads as a drop-off.
  const funnelOrder: Array<[string, string]> = [
    ["onboarding_start", "Started onboarding"],
    ["onboarding_step", "Answered a step"],
    ["whatsapp_optin", "WhatsApp opt-in"],
    ["onboarding_complete", "Completed onboarding"],
  ];
  const funnel: Seg[] = funnelOrder.map(([key, label]) => ({
    label,
    value: eventMix[key] || 0,
  }));

  // ---- documents: the content catalogue ----
  let documentsByType: Seg[] = [];
  let documentsByYear: Seg[] = [];
  let documentsByYearType: Array<Record<string, string | number>> = [];
  let documentTypes: string[] = [];
  let documentsTotal = 0;
  {
    const { data } = await supabase
      .from("documents")
      .select("doc_type, year")
      .limit(5000);
    if (data) {
      documentsTotal = data.length;
      documentsByType = tally(data, "doc_type");
      documentsByYear = tally(data, "year").sort(
        (a, b) => Number(a.label) - Number(b.label)
      );

      // Catalogue coverage as part-to-whole: how each year's set breaks down.
      documentTypes = documentsByType.map((t) => t.label);
      const grid: Record<string, Record<string, number>> = {};
      for (const row of data) {
        const year = row.year == null ? "Unknown" : String(row.year);
        const type = row.doc_type ? String(row.doc_type) : "other";
        grid[year] = grid[year] || {};
        grid[year][type] = (grid[year][type] || 0) + 1;
      }
      documentsByYearType = Object.entries(grid)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([year, types]) => {
          const row: Record<string, string | number> = { label: year };
          for (const t of documentTypes) row[t] = types[t] || 0;
          return row;
        });
    }
  }

  // ---- profiles: who the users are ----
  let profilesEnabled = false;
  let profilesTotal = 0;
  let optInRate = 0;
  let onboardedCount = 0;
  let byProgram: Seg[] = [];
  let byFaculty: Seg[] = [];
  let bySemester: Seg[] = [];
  let byDistrict: Seg[] = [];
  let byGoal: Seg[] = [];
  let referralSources: Seg[] = [];
  {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "program, faculty, semester, district, goal, referral_source, whatsapp_opt_in, onboarded_at"
      )
      .limit(10000);
    if (!error && data) {
      profilesEnabled = true;
      profilesTotal = data.length;
      byProgram = tally(data, "program").slice(0, 8);
      byFaculty = tally(data, "faculty").slice(0, 8);
      bySemester = tally(data, "semester").sort(
        (a, b) => Number(a.label) - Number(b.label)
      );
      byDistrict = tally(data, "district").slice(0, 10);
      byGoal = tally(data, "goal");
      referralSources = tally(data, "referral_source");
      const opted = data.filter((r) => r.whatsapp_opt_in).length;
      optInRate = data.length ? Math.round((opted / data.length) * 100) : 0;
      onboardedCount = data.filter((r) => r.onboarded_at).length;
    } else if (error && !tableMissing(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const eventsInRange = events.length;
  const downloadsInRange = eventMix.download || 0;
  const openersInRange = new Set(
    events.filter((e) => e.user_id).map((e) => e.user_id)
  ).size;

  return NextResponse.json({
    days,
    since: sinceIso,
    usersTotal: users.length,
    dau,
    wau,
    mau,
    eventsInRange,
    downloadsInRange,
    activeInRange: openersInRange,
    signups,
    cumulativeUsers,
    activeUsers,
    engagement,
    byHour,
    byWeekday,
    hourWeekday: {
      rows: weekdayNames,
      columns: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")),
      values: hourWeekday,
    },
    documents: {
      total: documentsTotal,
      byType: documentsByType,
      byYear: documentsByYear,
      byYearType: documentsByYearType,
      types: documentTypes,
    },
    profiles: {
      enabled: profilesEnabled,
      total: profilesTotal,
      optInRate,
      onboardedCount,
      byProgram,
      byFaculty,
      bySemester,
      byDistrict,
      byGoal,
      referralSources,
    },
    events: {
      enabled: eventsEnabled,
      mix: toSegs(eventMix),
      funnel,
      onboardingSteps: toSegs(onboardingSteps),
      topScreens: toSegs(screens, 10),
      topContent: toSegs(downloadTitles, 10),
      downloadsByType: toSegs(downloadTypes),
      loginMethods: toSegs(loginMethods),
    },
  });
}
