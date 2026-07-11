"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, RefreshCw, Power, AlertTriangle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminAdsWrite } from "@/lib/admin-ads";
import PageHeader from "@/components/page-header";

interface Placement {
  placement_key: string;
  label: string | null;
  format: string;
  enabled: boolean;
  frequency_cap_seconds: number | null;
  max_per_session: number | null;
  grace_seconds: number | null;
}

const FORMAT_STYLE: Record<string, string> = {
  banner: "bg-sky-100 text-sky-700",
  native: "bg-violet-100 text-violet-700",
  interstitial: "bg-amber-100 text-amber-700",
  rewarded: "bg-emerald-100 text-emerald-700",
  app_open: "bg-rose-100 text-rose-700",
};

// Only the full-screen formats honour the frequency knobs.
const CAPPED = new Set(["interstitial", "app_open"]);

export default function AdPlacementsPage() {
  const [rows, setRows] = useState<Placement[]>([]);
  const [master, setMaster] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const [placements, settings] = await Promise.all([
      supabase
        .from("ads_placements")
        .select(
          "placement_key, label, format, enabled, frequency_cap_seconds, max_per_session, grace_seconds"
        )
        .order("placement_key"),
      supabase.from("ads_settings").select("ads_enabled").eq("id", 1).maybeSingle(),
    ]);
    if (placements.error)
      setMessage(`Failed to load placements: ${placements.error.message}`);
    else setRows((placements.data ?? []) as Placement[]);
    setMaster(settings.data?.ads_enabled ?? true);
    setLoading(false);
  }, []);

  const setMasterEnabled = async (value: boolean) => {
    setMessage("");
    setMaster(value); // optimistic
    const error = await adminAdsWrite({ action: "set_master", enabled: value });
    if (error) {
      setMessage(`Failed to update master switch: ${error}`);
      load();
    } else {
      setMessage(
        value
          ? "Ads are ON globally. Individual placements below still apply."
          : "All ads are now OFF on every device."
      );
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (key: string, patch: Partial<Placement>) => {
    setMessage("");
    // optimistic update
    setRows((prev) =>
      prev.map((r) => (r.placement_key === key ? { ...r, ...patch } : r))
    );
    const error = await adminAdsWrite({
      action: "set_placement",
      placement_key: key,
      patch,
    });
    if (error) {
      setMessage(`Failed to save ${key}: ${error}`);
      load(); // roll back to server truth
    } else {
      setMessage(`Saved ${key}`);
    }
  };

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Ad Placements"
        subtitle="Turn each in-app ad slot on or off and tune how often the full-screen ones show"
      />

      {/* Global master kill switch — overrides every placement on every device. */}
      <div
        className={`mb-6 rounded-xl border p-5 shadow-md ${
          master === false
            ? "border-red-200 bg-red-50"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Power
              className={`h-6 w-6 shrink-0 ${
                master === false ? "text-red-600" : "text-green-600"
              }`}
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                All ads · every device
              </h2>
              <p className="text-sm text-gray-600">
                Master kill switch. When off, no ad shows anywhere, whatever the
                placements below say.
              </p>
            </div>
          </div>
          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={master ?? false}
              disabled={master === null}
              onChange={(e) => setMasterEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-7 w-14 rounded-full bg-gray-300 after:absolute after:left-[4px] after:top-0.5 after:h-6 after:w-6 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-green-300" />
          </label>
        </div>
        {master === false && (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Ads are globally disabled. The placements below are ignored until you
            turn this back on.
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {loading
            ? "Loading…"
            : `${enabledCount} of ${rows.length} placements enabled`}
        </p>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div
        className={`space-y-4 ${
          master === false ? "opacity-50" : ""
        }`}
      >
        {rows.map((p) => (
          <div key={p.placement_key} className="rounded-xl bg-white p-5 shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <LayoutGrid className="h-5 w-5 shrink-0 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {p.label ?? p.placement_key}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      FORMAT_STYLE[p.format] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p.format}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-gray-400">
                  {p.placement_key}
                </p>
              </div>

              <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) =>
                    persist(p.placement_key, { enabled: e.target.checked })
                  }
                  className="peer sr-only"
                />
                <div className="h-7 w-14 rounded-full bg-gray-300 after:absolute after:left-[4px] after:top-0.5 after:h-6 after:w-6 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-blue-300" />
              </label>
            </div>

            {CAPPED.has(p.format) && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
                <NumberField
                  label="Min gap (seconds)"
                  value={p.frequency_cap_seconds}
                  onCommit={(v) =>
                    persist(p.placement_key, { frequency_cap_seconds: v })
                  }
                />
                <NumberField
                  label="Max / session"
                  value={p.max_per_session}
                  onCommit={(v) =>
                    persist(p.placement_key, { max_per_session: v })
                  }
                />
                <NumberField
                  label="New-session grace (s)"
                  value={p.grace_seconds}
                  onCommit={(v) =>
                    persist(p.placement_key, { grace_seconds: v })
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {message && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
          {message}
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");

  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          onCommit(trimmed === "" ? null : Number(trimmed));
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}
