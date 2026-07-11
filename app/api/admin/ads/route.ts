import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

/**
 * Admin writes for the ad-control tables. These tables have RLS write policies
 * that require a Supabase Auth session (auth.uid() IS NOT NULL), but the panel
 * authenticates with its own username/password cookie (see /api/admin/login) and
 * talks to Supabase with only the anon key — so browser writes are rejected by
 * RLS. We route them here instead: requireAdmin() verifies the session cookie and
 * hands back a service-role client that bypasses RLS.
 *
 * Actions:
 *   set_master          — flip the global kill switch (ads_settings singleton)
 *   set_placement       — patch one global placement row (ads_placements)
 *   set_user_global     — per-user global ads on/off (ads_control)
 *   set_user_placement  — per-user, per-placement override (user_ads_placements)
 *   clear_user_placement— drop a per-user override so it follows the global value
 */

// Columns a caller may patch on a global placement row.
const PLACEMENT_FIELDS = new Set([
  "enabled",
  "frequency_cap_seconds",
  "max_per_session",
  "grace_seconds",
]);

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const now = new Date().toISOString();

  if (action === "set_master") {
    const enabled = Boolean(body.enabled);
    const { error } = await supabase
      .from("ads_settings")
      .upsert({ id: 1, ads_enabled: enabled, updated_at: now }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_placement") {
    const key = String(body.placement_key ?? "").trim();
    if (!key) {
      return NextResponse.json({ error: "placement_key is required" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.patch ?? {})) {
      if (PLACEMENT_FIELDS.has(k)) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    patch.updated_at = now;
    const { error } = await supabase
      .from("ads_placements")
      .update(patch)
      .eq("placement_key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_user_global") {
    const email = normalizeEmail(body.email);
    if (!email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    const { error } = await supabase.from("ads_control").upsert(
      { email, ads_enabled: Boolean(body.enabled), updated_at: now },
      { onConflict: "email" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_user_placement") {
    const email = normalizeEmail(body.email);
    const key = String(body.placement_key ?? "").trim();
    if (!email.includes("@") || !key) {
      return NextResponse.json(
        { error: "A valid email and placement_key are required" },
        { status: 400 }
      );
    }
    const { error } = await supabase.from("user_ads_placements").upsert(
      { email, placement_key: key, enabled: Boolean(body.enabled), updated_at: now },
      { onConflict: "email,placement_key" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_user_placement") {
    const email = normalizeEmail(body.email);
    const key = String(body.placement_key ?? "").trim();
    if (!email.includes("@") || !key) {
      return NextResponse.json(
        { error: "A valid email and placement_key are required" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("user_ads_placements")
      .delete()
      .eq("email", email)
      .eq("placement_key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
