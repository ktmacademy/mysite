"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, RefreshCw, Power, AlertTriangle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminAdsWrite } from "@/lib/admin-ads";
import PageHeader from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Placement {
  placement_key: string;
  label: string | null;
  format: string;
  enabled: boolean;
  frequency_cap_seconds: number | null;
  max_per_session: number | null;
  grace_seconds: number | null;
}

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
      <Card className={cn("mb-6", master === false && "border-destructive/40")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <Power
              className={cn(
                "size-5",
                master === false ? "text-destructive" : "text-primary"
              )}
            />
            All ads · every device
          </CardTitle>
          <CardDescription>
            Master kill switch. When off, no ad shows anywhere, whatever the
            placements below say.
          </CardDescription>
          <CardAction>
            <Switch
              checked={master ?? false}
              disabled={master === null}
              onCheckedChange={(v) => setMasterEnabled(Boolean(v))}
              aria-label="All ads on every device"
            />
          </CardAction>
        </CardHeader>
        {master === false && (
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                Ads are globally disabled. The placements below are ignored until
                you turn this back on.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : `${enabledCount} of ${rows.length} placements enabled`}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      <div className={cn("space-y-4", master === false && "opacity-60")}>
        {rows.map((p) => (
          <Card key={p.placement_key}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <LayoutGrid className="size-5 shrink-0 text-primary" />
                {p.label ?? p.placement_key}
                <Badge variant="secondary">{p.format}</Badge>
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {p.placement_key}
              </CardDescription>
              <CardAction>
                <Switch
                  checked={p.enabled}
                  onCheckedChange={(v) =>
                    persist(p.placement_key, { enabled: Boolean(v) })
                  }
                  aria-label={p.label ?? p.placement_key}
                />
              </CardAction>
            </CardHeader>

            {CAPPED.has(p.format) && (
              <CardContent className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
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
                  onCommit={(v) => persist(p.placement_key, { max_per_session: v })}
                />
                <NumberField
                  label="New-session grace (s)"
                  value={p.grace_seconds}
                  onCommit={(v) => persist(p.placement_key, { grace_seconds: v })}
                />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {message && (
        <Alert className="mt-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
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
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          onCommit(trimmed === "" ? null : Number(trimmed));
        }}
      />
    </div>
  );
}
