"use client";

import { FormEvent, useState } from "react";
import { Search, Settings as SettingsIcon, LayoutGrid, RotateCcw } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminAdsWrite } from "@/lib/admin-ads";
import PageHeader from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlacementRow {
  placement_key: string;
  label: string | null;
  format: string;
  enabled: boolean; // global default
}

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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <Search className="size-5 text-primary" />
            Search user
          </CardTitle>
          <CardDescription>
            Enter a user email to manage their ad settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFetch} className="space-y-4">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              <Search />
              {loading ? "Searching…" : "Fetch user settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {adsEnabled !== null && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <SettingsIcon className="size-5 text-primary" />
              All ads for this user
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <div>
                <p className="mb-1 font-medium">User: {email}</p>
                <p className="text-sm text-muted-foreground">
                  {adsEnabled ? "Ads enabled" : "Ads disabled (ad-free)"}
                </p>
              </div>
              <Switch
                checked={adsEnabled}
                onCheckedChange={(v) => handleToggle(Boolean(v))}
                disabled={loading}
                aria-label="All ads for this user"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {adsEnabled !== null && placements.length > 0 && (
        <Card className={cn("mb-6", !adsEnabled && "opacity-60")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <LayoutGrid className="size-5 text-primary" />
              Individual ads for this user
            </CardTitle>
            <CardDescription>
              Each slot follows the global default unless you override it here.
              {!adsEnabled &&
                " This user is ad-free, so these have no effect until you re-enable ads above."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {placements.map((p) => {
              const overridden = p.placement_key in overrides;
              return (
                <div
                  key={p.placement_key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {p.label ?? p.placement_key}
                      </span>
                      <Badge variant="secondary">{p.format}</Badge>
                      {overridden ? (
                        <Badge>overridden</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          following global
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {p.placement_key}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {overridden && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => clearOverride(p)}
                        title="Reset to global default"
                      >
                        <RotateCcw /> Reset
                      </Button>
                    )}
                    <Switch
                      checked={effective(p)}
                      onCheckedChange={(v) => setPlacementOverride(p, Boolean(v))}
                      aria-label={p.label ?? p.placement_key}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {message && (
        <Alert>
          <SettingsIcon />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
