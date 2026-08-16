"use client";

import { useEffect, useState } from "react";
import {
  Users,
  MessageCircle,
  Flame,
  FileText,
  Bell,
  Settings,
  FileText as DocIcon,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import BarChart from "@/components/bar-chart";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface Overview {
  counts: {
    users: number;
    documents: number | null;
    notifications: number | null;
    loksewa: number | null;
    feedback: number | null;
    adsDisabled: number | null;
    whatsappOptIns: number | null;
    activeToday: number;
    signupsThisWeek: number;
  };
  signupsByDay: Record<string, number>;
  activity: { type: string; title: string; subtitle: string; at: string }[];
}

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString();

const TILES = [
  {
    key: "users",
    label: "Total users",
    icon: Users,
    delta: (o: Overview) => `+${o.counts.signupsThisWeek} this week`,
  },
  {
    key: "whatsappOptIns",
    label: "WhatsApp opt-ins",
    icon: MessageCircle,
    delta: () => "consent-based",
  },
  { key: "activeToday", label: "Active today", icon: Flame, delta: () => "signed in today" },
  {
    key: "documents",
    label: "Documents",
    icon: FileText,
    delta: () => "notes · pyqs · solutions",
  },
  { key: "notifications", label: "Notifications", icon: Bell, delta: () => "sent" },
  { key: "adsDisabled", label: "Ads disabled", icon: Settings, delta: () => "users" },
] as const;

const ACTIVITY_ICON: Record<string, typeof DocIcon> = {
  document: DocIcon,
  notification: Bell,
  feedback: MessageSquare,
  user: UserPlus,
};

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<Overview>("/api/admin/overview", {})
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const days = data ? Object.entries(data.signupsByDay) : [];

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader title="Overview" subtitle="State of the app at a glance" />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!data && !error && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {TILES.map((t) => {
              const value = (data.counts as any)[t.key] as number | null;
              return (
                <Card key={t.key}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <t.icon className="size-4" />
                      {t.label}
                    </div>
                    <div className="text-2xl font-bold">{num(value)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {value === null ? "run migration to enable" : t.delta(data)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="border-b">
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.activity.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nothing yet.
                  </div>
                )}
                {data.activity.map((a, i) => {
                  const Icon = ACTIVITY_ICON[a.type] || DocIcon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3",
                        i < data.activity.length - 1 && "border-b"
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.subtitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(a.at)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signups · 7 days</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  bars={days.map(([day, v]) => ({
                    label: day,
                    tick: day.slice(8),
                    value: v,
                  }))}
                  height={190}
                  valueLabel="signups"
                  xLabel="Day of month"
                  yLabel="Signups"
                />
                <div className="mt-3 text-xs text-muted-foreground">
                  {data.counts.signupsThisWeek} new users this week
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
