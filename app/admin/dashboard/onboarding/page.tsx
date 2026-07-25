"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DoorOpen,
  Save,
  RefreshCw,
  AlertTriangle,
  Pencil,
  X,
  ImageIcon,
} from "lucide-react";
import { adminGet, adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

interface Slide {
  title: string;
  subtitle: string;
  image_url: string;
  enabled: boolean;
}

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
  slides: Slide[];
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

// The onboarding flow is a fixed set of pages 1..5. The table always shows all
// five so page numbers stay stable; empty pages default to disabled.
const PAGE_COUNT = 5;

const EMPTY_SLIDE: Slide = {
  title: "",
  subtitle: "",
  image_url: "",
  enabled: false,
};

const EMPTY: OnboardingSettings = {
  skip_enabled: true,
  skip_button_label: "Skip for now",
  welcome_title: "",
  welcome_subtitle: "",
  slides: [],
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

/** Pad/trim an incoming slides array to exactly PAGE_COUNT rows. */
function toFivePages(raw: unknown): Slide[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PAGE_COUNT }, (_, i) => {
    const s = (arr[i] ?? {}) as Partial<Slide>;
    return {
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
      image_url: s.image_url ?? "",
      // Missing flag on an existing page => enabled (back-compat); brand-new
      // empty page => disabled so it doesn't show a blank slide in the app.
      enabled:
        s.enabled === undefined ? Boolean(s.title || s.subtitle) : Boolean(s.enabled),
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
  const [editing, setEditing] = useState<number | null>(null);

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
        slides: toFivePages(settings.slides),
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

  function updateSlide(index: number, patch: Partial<Slide>) {
    setForm((f) => {
      const slides = [...f.slides];
      slides[index] = { ...slides[index], ...patch };
      return { ...f, slides };
    });
  }

  function toggleSlide(index: number) {
    setForm((f) => {
      const slides = [...f.slides];
      slides[index] = { ...slides[index], enabled: !slides[index].enabled };
      return { ...f, slides };
    });
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

  const editingSlide = editing !== null ? form.slides[editing] : null;

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="Control the login-screen Skip button, the welcome content, the in-app form steps (and their Skip buttons), and the 5 intro pages shown to new users"
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

          {/* Onboarding pages (1..5) */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-md">
            <div className="border-b border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Onboarding pages
              </h2>
              <p className="text-sm text-gray-600">
                The five intro pages shown to new users. Toggle a page on or off,
                or edit its title and content.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Page</th>
                    <th className="px-5 py-3 font-semibold">Title &amp; content</th>
                    <th className="px-5 py-3 text-center font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.slides.map((slide, i) => {
                    const isSet = Boolean(slide.title || slide.subtitle);
                    return (
                      <tr key={i} className="align-middle hover:bg-gray-50">
                        <td className="px-5 py-4 font-semibold text-gray-500">
                          {i + 1}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {slide.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={slide.image_url}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div
                                className={`truncate font-medium ${
                                  isSet ? "text-gray-900" : "italic text-gray-400"
                                }`}
                              >
                                {slide.title || "Not set"}
                              </div>
                              {slide.subtitle && (
                                <div className="truncate text-xs text-gray-500">
                                  {slide.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center">
                            <label
                              className="relative inline-flex cursor-pointer items-center"
                              title={slide.enabled ? "Enabled" : "Disabled"}
                            >
                              <input
                                type="checkbox"
                                checked={slide.enabled}
                                onChange={() => toggleSlide(i)}
                                className="peer sr-only"
                              />
                              <div className="h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-green-300" />
                            </label>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setEditing(i)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      {/* Edit page modal */}
      {editing !== null && editingSlide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit page {editing + 1}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-700">
                  Show this page
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={editingSlide.enabled}
                    onChange={() => toggleSlide(editing)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-green-300" />
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  value={editingSlide.title}
                  maxLength={120}
                  onChange={(e) => updateSlide(editing, { title: e.target.value })}
                  placeholder="Page title"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Subtitle
                </label>
                <textarea
                  value={editingSlide.subtitle}
                  maxLength={240}
                  rows={3}
                  onChange={(e) =>
                    updateSlide(editing, { subtitle: e.target.value })
                  }
                  placeholder="Page subtitle / description"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Image URL{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editingSlide.image_url}
                  maxLength={500}
                  onChange={(e) =>
                    updateSlide(editing, { image_url: e.target.value })
                  }
                  placeholder="https://…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 p-5">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
