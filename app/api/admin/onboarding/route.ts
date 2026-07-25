import { NextResponse } from "next/server";
import { requireAdmin, tableMissing } from "@/lib/server/admin";

/**
 * Admin read/write for the onboarding / login-gate settings singleton
 * (public.onboarding_settings, row id = 1).
 *
 * The table has RLS write policies that require a Supabase Auth session, but the
 * panel authenticates with its own cookie and the anon key — so we route writes
 * here: requireAdmin() verifies the session cookie and hands back a service-role
 * client that bypasses RLS (same pattern as /api/admin/ads).
 *
 *   GET  -> current settings (falls back to defaults if the row/table is absent)
 *   POST -> patch the singleton with { patch: { ...allowed fields } }
 */

const ROW_ID = 1;

const DEFAULTS = {
  id: ROW_ID,
  skip_enabled: true,
  skip_button_label: "Skip for now",
  welcome_title: "Welcome to CTEVT Plus (KTM Academy)",
  welcome_subtitle: "Your companion for preparation",
  slides: [] as unknown[],
  form_steps: [] as unknown[],
};

/**
 * The app's onboarding fill-out steps, in order. These keys are a contract with
 * the Flutter app (OnboardingFormStep) — never rename or reorder them; the app
 * matches on `key` and supplies its own default copy per key.
 */
const FORM_STEP_KEYS = [
  "welcome",
  "study",
  "location",
  "referral",
  "whatsapp",
] as const;

// Fields a caller may patch, with their coercion.
type Coercer = (v: unknown) => unknown;
const FIELDS: Record<string, Coercer> = {
  skip_enabled: (v) => Boolean(v),
  skip_button_label: (v) => String(v ?? "").trim().slice(0, 60),
  welcome_title: (v) => String(v ?? "").trim().slice(0, 120),
  welcome_subtitle: (v) => String(v ?? "").trim().slice(0, 240),
  slides: (v) => normalizeSlides(v),
  form_steps: (v) => normalizeFormSteps(v),
};

/**
 * Coerce arbitrary input into one clean row per known fill-out step, in
 * FORM_STEP_KEYS order. Unknown keys are dropped and missing ones are filled in
 * as fully enabled, so the stored array is always the complete, ordered set —
 * the app can then trust it without reconciling.
 */
function normalizeFormSteps(value: unknown): Array<{
  key: string;
  enabled: boolean;
  skip_enabled: boolean;
  title: string;
  subtitle: string;
}> {
  const incoming = new Map<string, Record<string, unknown>>();
  if (Array.isArray(value)) {
    for (const raw of value) {
      const s = (raw ?? {}) as Record<string, unknown>;
      const key = String(s.key ?? "");
      if ((FORM_STEP_KEYS as readonly string[]).includes(key)) {
        incoming.set(key, s);
      }
    }
  }
  return FORM_STEP_KEYS.map((key) => {
    const s = incoming.get(key) ?? {};
    return {
      key,
      enabled: s.enabled === undefined ? true : Boolean(s.enabled),
      skip_enabled: s.skip_enabled === undefined ? true : Boolean(s.skip_enabled),
      title: String(s.title ?? "").trim().slice(0, 120),
      subtitle: String(s.subtitle ?? "").trim().slice(0, 240),
    };
  });
}

/**
 * Coerce arbitrary input into a clean array of onboarding pages
 * [{title, subtitle, image_url, enabled}]. `enabled` lets the admin toggle an
 * individual page on/off without deleting it; missing => enabled (back-compat
 * with rows saved before the flag existed). Capped at 5 pages.
 */
function normalizeSlides(
  value: unknown,
): Array<{ title: string; subtitle: string; image_url: string; enabled: boolean }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    return {
      title: String(s.title ?? "").trim().slice(0, 120),
      subtitle: String(s.subtitle ?? "").trim().slice(0, 240),
      image_url: String(s.image_url ?? "").trim().slice(0, 500),
      enabled: s.enabled === undefined ? true : Boolean(s.enabled),
    };
  });
}

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { data, error } = await check.supabase
    .from("onboarding_settings")
    .select("*")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error && !tableMissing(error)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Missing table (migration not applied yet) or missing row -> defaults.
  return NextResponse.json({ settings: data ?? DEFAULTS, missing: !data });
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const body = await request.json().catch(() => ({}));
  const input = (body.patch ?? {}) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const [key, coerce] of Object.entries(FIELDS)) {
    if (key in input) patch[key] = coerce(input[key]);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  patch.id = ROW_ID;
  patch.updated_at = new Date().toISOString();

  const { error } = await check.supabase
    .from("onboarding_settings")
    .upsert(patch, { onConflict: "id" });

  if (error) {
    const msg = /form_steps/i.test(error.message || "")
      ? "onboarding_settings.form_steps column is missing — apply the " +
        "20260725020000_onboarding_form_steps migration first."
      : tableMissing(error)
        ? "onboarding_settings table is missing — run the migration first."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
