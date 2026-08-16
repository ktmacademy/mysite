"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Save, RefreshCw, AlertTriangle } from "lucide-react";
import { adminGet, adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

/** Labelled on/off switch, used for the per-step controls. */
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
    <Label
      className={cn(
        "flex items-center gap-2 text-xs",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {label}
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(Boolean(v))}
        aria-label={label}
      />
    </Label>
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
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Onboarding"
        subtitle="Control the login-screen Skip button, the welcome content, and the in-app form steps (and their Skip buttons)"
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Skip button control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <DoorOpen
                  className={cn(
                    "size-5 shrink-0",
                    form.skip_enabled ? "text-primary" : "text-muted-foreground"
                  )}
                />
                Allow &ldquo;Skip&rdquo; on the login screen
              </CardTitle>
              <CardDescription>
                When on, users see a Skip button and can enter the app without
                signing in. When off, sign-in is required.
              </CardDescription>
              <CardAction>
                <Switch
                  checked={form.skip_enabled}
                  onCheckedChange={(v) => patchField("skip_enabled", Boolean(v))}
                  aria-label="Allow Skip on the login screen"
                />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="skip-label">Skip button label</Label>
              <Input
                id="skip-label"
                value={form.skip_button_label}
                disabled={!form.skip_enabled}
                maxLength={60}
                onChange={(e) => patchField("skip_button_label", e.target.value)}
                placeholder="Skip for now"
                className="max-w-sm"
              />
            </CardContent>
          </Card>

          {/* Welcome content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Welcome content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="welcome-title">Welcome title</Label>
                <Input
                  id="welcome-title"
                  value={form.welcome_title}
                  maxLength={120}
                  onChange={(e) => patchField("welcome_title", e.target.value)}
                  placeholder="CTEVT Plus (KTM Academy)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcome-subtitle">Welcome subtitle</Label>
                <Textarea
                  id="welcome-subtitle"
                  value={form.welcome_subtitle}
                  maxLength={240}
                  rows={2}
                  onChange={(e) => patchField("welcome_subtitle", e.target.value)}
                  placeholder="Your companion for CTEVT preparation"
                />
              </div>
            </CardContent>
          </Card>

          {/* In-app form steps */}
          <Card className="py-0">
            <CardHeader className="border-b py-5">
              <CardTitle className="text-lg">Form steps (after sign-in)</CardTitle>
              <CardDescription>
                The questions the app asks a new user, in order. Turn a step off
                to drop it from the flow, and decide per step whether the user
                gets a &ldquo;Skip&rdquo; button. Turning Skip off makes that
                step&rsquo;s answer required in the app. Leave title and subtitle
                blank to keep the app&rsquo;s built-in wording.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-0">
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
                  <div
                    key={meta.key}
                    className={cn("p-5", i < FORM_STEPS.length - 1 && "border-b")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="rounded-full">
                            {i + 1}
                          </Badge>
                          <h3
                            className={cn(
                              "font-semibold",
                              !step.enabled && "text-muted-foreground"
                            )}
                          >
                            {meta.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Collects: {meta.collects}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-6">
                        <Toggle
                          label="Show step"
                          checked={step.enabled}
                          onChange={(v) => updateFormStep(meta.key, { enabled: v })}
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
                      <div className="space-y-1.5">
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={step.title}
                          maxLength={120}
                          disabled={!step.enabled}
                          onChange={(e) =>
                            updateFormStep(meta.key, { title: e.target.value })
                          }
                          placeholder={meta.defaultTitle}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Subtitle</Label>
                        <Input
                          value={step.subtitle}
                          maxLength={240}
                          disabled={!step.enabled}
                          onChange={(e) =>
                            updateFormStep(meta.key, { subtitle: e.target.value })
                          }
                          placeholder={meta.defaultSubtitle}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
