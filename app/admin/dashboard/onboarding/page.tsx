"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Save, Plus, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { adminGet, adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

interface Slide {
  title: string;
  subtitle: string;
  image_url: string;
}

interface OnboardingSettings {
  skip_enabled: boolean;
  skip_button_label: string;
  welcome_title: string;
  welcome_subtitle: string;
  slides: Slide[];
}

const EMPTY: OnboardingSettings = {
  skip_enabled: true,
  skip_button_label: "Skip for now",
  welcome_title: "",
  welcome_subtitle: "",
  slides: [],
};

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
        slides: Array.isArray(settings.slides) ? settings.slides : [],
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

  function updateSlide(index: number, key: keyof Slide, value: string) {
    setForm((f) => {
      const slides = [...f.slides];
      slides[index] = { ...slides[index], [key]: value };
      return { ...f, slides };
    });
  }

  function addSlide() {
    setForm((f) => ({
      ...f,
      slides: [...f.slides, { title: "", subtitle: "", image_url: "" }],
    }));
  }

  function removeSlide(index: number) {
    setForm((f) => ({ ...f, slides: f.slides.filter((_, i) => i !== index) }));
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
        subtitle="Control the login-screen Skip button and the welcome content shown to new users"
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
                  placeholder="Welcome to CTEVT+"
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

          {/* Intro slides (optional) */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Intro slides{" "}
                  <span className="text-sm font-normal text-gray-500">(optional)</span>
                </h2>
                <p className="text-sm text-gray-600">
                  Ordered welcome slides. Leave empty to just use the title &amp;
                  subtitle above.
                </p>
              </div>
              <button
                onClick={addSlide}
                disabled={form.slides.length >= 10}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Plus className="h-4 w-4" /> Add slide
              </button>
            </div>

            {form.slides.length === 0 ? (
              <p className="text-sm text-gray-400">No slides yet.</p>
            ) : (
              <div className="space-y-4">
                {form.slides.map((slide, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-500">
                        Slide {i + 1}
                      </span>
                      <button
                        onClick={() => removeSlide(i)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={`Remove slide ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={slide.title}
                        maxLength={120}
                        onChange={(e) => updateSlide(i, "title", e.target.value)}
                        placeholder="Slide title"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={slide.subtitle}
                        maxLength={240}
                        onChange={(e) => updateSlide(i, "subtitle", e.target.value)}
                        placeholder="Slide subtitle"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={slide.image_url}
                        maxLength={500}
                        onChange={(e) => updateSlide(i, "image_url", e.target.value)}
                        placeholder="Image URL (optional)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
