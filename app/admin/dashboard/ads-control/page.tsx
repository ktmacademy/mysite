"use client";

import { FormEvent, useState } from "react";
import { Search, Settings as SettingsIcon, LayoutGrid, RotateCcw } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminAdsWrite } from "@/lib/admin-ads";
import PageHeader from "@/components/page-header";

interface PlacementRow {
  placement_key: string;
  label: string | null;
  format: string;
  enabled: boolean; // global default
}

const FORMAT_STYLE: Record<string, string> = {
  banner: "bg-sky-100 text-sky-700",
  native: "bg-violet-100 text-violet-700",
  interstitial: "bg-amber-100 text-amber-700",
  rewarded: "bg-emerald-100 text-emerald-700",
  app_open: "bg-rose-100 text-rose-700",
};

export default function AdsControlPage() {
  const [email, setEmail] = useState("");
  const [adsEnabled, setAdsEnabled] = useState<boolean | null>(null);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  // Per-user overrides: placement_key -> enabled. Absent = follow global.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const normalizedEmail = () => email.trim().toLowerCase();

  const handleFetch = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setMessage("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setMessage("");
    const supabase = getSupabase();

    const [control, globalPlacements, userOverrides] = await Promise.all([
      supabase
        .from("ads_control")
        .select("ads_enabled")
        .eq("email", normalizedEmail())
        .maybeSingle(),
      supabase
        .from("ads_placements")
        .select("placement_key, label, format, enabled")
        .order("placement_key"),
      supabase
        .from("user_ads_placements")
        .select("placement_key, enabled")
        .eq("email", normalizedEmail()),
    ]);

    if (control.error) {
      setMessage(`Failed to fetch status: ${control.error.message}`);
      setAdsEnabled(null);
    } else {
      setAdsEnabled(control.data?.ads_enabled ?? true);
    }
    setPlacements((globalPlacements.data ?? []) as PlacementRow[]);
    setOverrides(
      Object.fromEntries(
        (userOverrides.data ?? []).map((r) => [r.placement_key, r.enabled])
      )
    );
    setLoading(false);
  };

  const handleToggle = async (newValue: boolean) => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    const error = await adminAdsWrite({
      action: "set_user_global",
      email: normalizedEmail(),
      enabled: newValue,
    });
    if (error) setMessage(`Failed to update status: ${error}`);
    else {
      setAdsEnabled(newValue);
      setMessage(`Ad setting updated for ${email}`);
    }
    setLoading(false);
  };

  // effective per-user value shown on the toggle = override ?? global default
  const effective = (p: PlacementRow) =>
    p.placement_key in overrides ? overrides[p.placement_key] : p.enabled;

  const setPlacementOverride = async (p: PlacementRow, value: boolean) => {
    setMessage("");
    setOverrides((prev) => ({ ...prev, [p.placement_key]: value }));
    const error = await adminAdsWrite({
      action: "set_user_placement",
      email: normalizedEmail(),
      placement_key: p.placement_key,
      enabled: value,
    });
    if (error) setMessage(`Failed to override ${p.placement_key}: ${error}`);
  };

  const clearOverride = async (p: PlacementRow) => {
    setMessage("");
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[p.placement_key];
      return next;
    });
    const error = await adminAdsWrite({
      action: "clear_user_placement",
      email: normalizedEmail(),
      placement_key: p.placement_key,
    });
    if (error) setMessage(`Failed to reset ${p.placement_key}: ${error}`);
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Ads Control"
        subtitle="Manage a single user's ads — the global kill switch and each ad slot individually"
      />

      {/* Search Card */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center gap-3">
          <Search className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Search User</h2>
        </div>
        <p className="mb-6 text-gray-600">
          Enter a user email to manage their ad settings
        </p>
        <form onSubmit={handleFetch} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Search className="h-5 w-5" />
            {loading ? "Searching..." : "Fetch User Settings"}
          </button>
        </form>
      </div>

      {/* Global per-user toggle */}
      {adsEnabled !== null && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              All ads for this user
            </h2>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div>
              <p className="mb-1 font-medium text-gray-900">User: {email}</p>
              <p
                className={`text-sm font-medium ${
                  adsEnabled ? "text-green-600" : "text-red-600"
                }`}
              >
                {adsEnabled ? "Ads Enabled" : "Ads Disabled (ad-free)"}
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={(e) => handleToggle(e.target.checked)}
                disabled={loading}
                className="peer sr-only"
              />
              <div className="h-7 w-14 rounded-full bg-gray-300 after:absolute after:left-[4px] after:top-0.5 after:h-6 after:w-6 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-blue-300" />
            </label>
          </div>
        </div>
      )}

      {/* Per-placement per-user overrides */}
      {adsEnabled !== null && placements.length > 0 && (
        <div className={`mb-6 rounded-xl bg-white p-6 shadow-md ${adsEnabled ? "" : "opacity-50"}`}>
          <div className="mb-2 flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Individual ads for this user
            </h2>
          </div>
          <p className="mb-5 text-sm text-gray-600">
            Each slot follows the global default unless you override it here.
            {!adsEnabled && " (This user is ad-free, so these have no effect until you re-enable ads above.)"}
          </p>
          <div className="space-y-3">
            {placements.map((p) => {
              const overridden = p.placement_key in overrides;
              return (
                <div
                  key={p.placement_key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {p.label ?? p.placement_key}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          FORMAT_STYLE[p.format] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.format}
                      </span>
                      {overridden ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          overridden
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">following global</span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">
                      {p.placement_key}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {overridden && (
                      <button
                        onClick={() => clearOverride(p)}
                        title="Reset to global default"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                    )}
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={effective(p)}
                        onChange={(e) => setPlacementOverride(p, e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[3px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <SettingsIcon className="h-5 w-5 text-blue-600" />
          <p className="text-blue-800">{message}</p>
        </div>
      )}
    </div>
  );
}
