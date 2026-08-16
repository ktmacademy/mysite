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
  { key: "users", label: "Total users", icon: Users, accent: "bg-pink-500", delta: (o: Overview) => `+${o.counts.signupsThisWeek} this week` },
  { key: "whatsappOptIns", label: "WhatsApp opt-ins", icon: MessageCircle, accent: "bg-green-500", delta: () => "consent-based" },
  { key: "activeToday", label: "Active today", icon: Flame, accent: "bg-sky-500", delta: () => "signed in today" },
  { key: "documents", label: "Documents", icon: FileText, accent: "bg-emerald-500", delta: () => "notes · pyqs · solutions" },
  { key: "notifications", label: "Notifications", icon: Bell, accent: "bg-green-500", delta: () => "sent" },
  { key: "adsDisabled", label: "Ads disabled", icon: Settings, accent: "bg-blue-500", delta: () => "users" },
] as const;

const ACTIVITY_ICON: Record<string, { icon: typeof DocIcon; color: string }> = {
  document: { icon: DocIcon, color: "bg-emerald-500" },
  notification: { icon: Bell, color: "bg-green-500" },
  feedback: { icon: MessageSquare, color: "bg-purple-500" },
  user: { icon: UserPlus, color: "bg-pink-500" },
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
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {!data && !error && <div className="text-gray-500">Loading…</div>}

      {data && (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {TILES.map((t) => {
              const value = (data.counts as any)[t.key] as number | null;
              return (
                <div
                  key={t.key}
                  className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${t.accent}`} />
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{num(value)}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    {value === null ? "run migration to enable" : t.delta(data)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Recent activity */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
              <div className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">
                Recent activity
              </div>
              <div>
                {data.activity.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">Nothing yet.</div>
                )}
                {data.activity.map((a, i) => {
                  const meta = ACTIVITY_ICON[a.type] || ACTIVITY_ICON.document;
                  return (
                    <div key={i} className="flex items-center gap-3 border-b border-gray-50 px-5 py-3 last:border-0">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${meta.color}`}>
                        <meta.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                        <p className="truncate text-xs text-gray-500">{a.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{timeAgo(a.at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signups sparkline */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 font-semibold text-gray-900">Signups · 7 days</div>
              <BarChart
                bars={days.map(([day, v]) => ({
                  label: day,
                  tick: day.slice(8),
                  value: v,
                }))}
                valueLabel="signups"
              />
              <div className="mt-3 text-xs text-gray-400">
                {data.counts.signupsThisWeek} new users this week
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
