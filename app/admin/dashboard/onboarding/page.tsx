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

interface OnboardingSettings {
  skip_enabled: boolean;
  skip_button_label: string;
  welcome_title: string;
  welcome_subtitle: string;
  slides: Slide[];
}

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
};

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
        subtitle="Control the login-screen Skip button, the welcome content, and the 5 onboarding pages shown to new users"
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
