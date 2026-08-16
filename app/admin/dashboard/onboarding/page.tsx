"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Save, RefreshCw, AlertTriangle } from "lucide-react";
import { adminGet, adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

/** One admin-managed fill-out step of the in-app onboarding form. */
interface FormStep {
  key: string;
  enabled: boolean;
  skip_enabled: boolean;
  title: string;
  subtitle: string;
}

interface OnboardingSettings {
  skip_enabled: boolean;
  skip_button_label: string;
  welcome_title: string;
  welcome_subtitle: string;
  form_steps: FormStep[];
}

/**
 * The fill-out steps the app actually shows after sign-in, in order. `key` is a
 * contract with the Flutter app — never rename or reorder. `defaultTitle` /
 * `defaultSubtitle` mirror the app's built-in copy so the admin sees what the
 * user sees; leaving the inputs blank keeps those built-in strings.
 */
const FORM_STEPS: Array<{
  key: string;
  name: string;
  collects: string;
  defaultTitle: string;
  defaultSubtitle: string;
}> = [
  {
    key: "welcome",
    name: "Welcome & goal",
    collects: "Full name, what they're here for",
    defaultTitle: "Welcome to KTM Academy",
    defaultSubtitle:
      "A few quick questions so we can tailor your notes and alerts.",
  },
  {
    key: "study",
    name: "Study details",
    collects: "Program, faculty, year / semester",
    defaultTitle: "What are you studying?",
    defaultSubtitle: "Pick your program so we show the right notes first.",
  },
  {
    key: "location",
    name: "Location",
    collects: "District (auto-detect or pick from list)",
    defaultTitle: "Where are you studying from?",
    defaultSubtitle: "Helps us understand where our students are. Optional.",
  },
  {
    key: "referral",
    name: "Referral source",
    collects: "Facebook, YouTube, a friend, Play search, other",
    defaultTitle: "How did you hear about us?",
    defaultSubtitle: "This helps us reach more students like you.",
  },
  {
    key: "whatsapp",
    name: "WhatsApp updates",
    collects: "WhatsApp number, updates opt-in",
    defaultTitle: "Never miss new notes",
    defaultSubtitle:
      "Get new notes and result alerts on WhatsApp. Free, and you can stop anytime.",
  },
];

const EMPTY: OnboardingSettings = {
  skip_enabled: true,
  skip_button_label: "Skip for now",
  welcome_title: "",
  welcome_subtitle: "",
  form_steps: [],
};

/**
 * Reconcile whatever is stored into exactly one row per known step, in
 * FORM_STEPS order. Missing rows (nothing saved yet, or a step added after the
 * last save) come back fully enabled.
 */
function toFormSteps(raw: unknown): FormStep[] {
  const arr = Array.isArray(raw) ? (raw as Partial<FormStep>[]) : [];
  return FORM_STEPS.map((meta) => {
    const s = arr.find((x) => x?.key === meta.key) ?? {};
    return {
      key: meta.key,
      enabled: s.enabled === undefined ? true : Boolean(s.enabled),
      skip_enabled: s.skip_enabled === undefined ? true : Boolean(s.skip_enabled),
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
    };
  });
}

/** Labelled on/off switch, styled like the other switches on this page. */
function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-green-300" />
      </span>
    </label>
  );
}

export default function OnboardingPage() {
  const [form, setForm] = useState<OnboardingSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { settings } = await adminGet<{ settings: OnboardingSettings }>(
        "/api/admin/onboarding"
      );
      setForm({
        skip_enabled: Boolean(settings.skip_enabled),
        skip_button_label: settings.skip_button_label ?? "",
        welcome_title: settings.welcome_title ?? "",
        welcome_subtitle: settings.welcome_subtitle ?? "",
        form_steps: toFormSteps(settings.form_steps),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchField<K extends keyof OnboardingSettings>(
    key: K,
    value: OnboardingSettings[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateFormStep(key: string, patch: Partial<FormStep>) {
    setForm((f) => ({
      ...f,
      form_steps: f.form_steps.map((s) =>
        s.key === key ? { ...s, ...patch } : s
      ),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await adminFetch("/api/admin/onboarding", { patch: form });
      setMessage("Saved. Changes go live on the app's next config refresh.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="Control the login-screen Skip button, the welcome content, and the in-app form steps (and their Skip buttons)"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Skip button control */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <DoorOpen
                  className={`h-6 w-6 shrink-0 ${
                    form.skip_enabled ? "text-green-600" : "text-gray-400"
                  }`}
                />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Allow &ldquo;Skip&rdquo; on the login screen
                  </h2>
                  <p className="text-sm text-gray-600">
                    When on, users see a Skip button and can enter the app without
                    signing in. When off, sign-in is required.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.skip_enabled}
                  onChange={(e) => patchField("skip_enabled", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-7 w-14 rounded-full bg-gray-300 after:absolute after:left-[4px] after:top-0.5 after:h-6 after:w-6 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-green-300" />
              </label>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Skip button label
              </label>
              <input
                type="text"
                value={form.skip_button_label}
                disabled={!form.skip_enabled}
                maxLength={60}
                onChange={(e) => patchField("skip_button_label", e.target.value)}
                placeholder="Skip for now"
                className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* Welcome content */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Welcome content
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Welcome title
                </label>
                <input
                  type="text"
                  value={form.welcome_title}
                  maxLength={120}
                  onChange={(e) => patchField("welcome_title", e.target.value)}
                  placeholder="CTEVT Plus (KTM Academy)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Welcome subtitle
                </label>
                <textarea
                  value={form.welcome_subtitle}
                  maxLength={240}
                  rows={2}
                  onChange={(e) => patchField("welcome_subtitle", e.target.value)}
                  placeholder="Your companion for CTEVT preparation"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* In-app form steps */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-md">
            <div className="border-b border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Form steps (after sign-in)
              </h2>
              <p className="text-sm text-gray-600">
                The questions the app asks a new user, in order. Turn a step off
                to drop it from the flow, and decide per step whether the user
                gets a &ldquo;Skip&rdquo; button. Leave title and subtitle blank
                to keep the app&rsquo;s built-in wording.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {FORM_STEPS.map((meta, i) => {
                const step =
                  form.form_steps.find((s) => s.key === meta.key) ??
                  ({
                    key: meta.key,
                    enabled: true,
                    skip_enabled: true,
                    title: "",
                    subtitle: "",
                  } as FormStep);
                return (
                  <div key={meta.key} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                            {i + 1}
                          </span>
                          <h3
                            className={`font-semibold ${
                              step.enabled ? "text-gray-900" : "text-gray-400"
                            }`}
                          >
                            {meta.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Collects: {meta.collects}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-6">
                        <Toggle
                          label="Show step"
                          checked={step.enabled}
                          onChange={(v) =>
                            updateFormStep(meta.key, { enabled: v })
                          }
                        />
                        <Toggle
                          label="Skip button"
                          checked={step.skip_enabled}
                          disabled={!step.enabled}
                          onChange={(v) =>
                            updateFormStep(meta.key, { skip_enabled: v })
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Title
                        </label>
                        <input
                          type="text"
                          value={step.title}
                          maxLength={120}
                          disabled={!step.enabled}
                          onChange={(e) =>
                            updateFormStep(meta.key, { title: e.target.value })
                          }
                          placeholder={meta.defaultTitle}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={step.subtitle}
                          maxLength={240}
                          disabled={!step.enabled}
                          onChange={(e) =>
                            updateFormStep(meta.key, {
                              subtitle: e.target.value,
                            })
                          }
                          placeholder={meta.defaultSubtitle}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
