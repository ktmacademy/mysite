"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import BarChart from "@/components/bar-chart";

interface Seg {
  label: string;
  value: number;
}
interface Resp {
  usersTotal: number;
  dau: number;
  wau: number;
  mau: number;
  signups14: { day: string; value: number }[];
  documentsByType: Seg[];
  profiles: {
    enabled: boolean;
    total: number;
    optInRate: number;
    onboardedCount: number;
    byProgram: Seg[];
    bySemester: Seg[];
    byDistrict: Seg[];
    referralSources: Seg[];
  };
  events: { enabled: boolean; funnel: Seg[]; topContent: Seg[] };
}

function HBars({ data, color = "blue" }: { data: Seg[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const bar =
    color === "green" ? "from-green-400 to-green-600" : color === "pink" ? "from-pink-400 to-pink-600" : "from-blue-400 to-blue-700";
  if (data.length === 0)
    return <p className="px-4 py-6 text-center text-sm text-gray-400">No data yet.</p>;
  return (
    <div className="space-y-3 p-4">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-gray-600">{d.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <span className={`block h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="w-12 shrink-0 text-right font-medium text-gray-700">{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${wide ? "lg:col-span-2" : ""}`}>
      <div className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">{title}</div>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<Resp>("/api/admin/analytics", {})
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);


  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader title="Analytics & insights" subtitle="Who your users are, where they come from, what they use" />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}
      {!data && !error && <div className="text-gray-500">Loading…</div>}

      {data && (
        <>
          {(!data.profiles.enabled || !data.events.enabled) && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Some panels are waiting for data. Segment charts need the <code>profiles</code> table; the funnel and
              top-content need <code>analytics_events</code> to receive events. Apply the growth migration and ship the
              app onboarding + event logging to fill them in.
            </div>
          )}

          {/* KPI row */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Active today", value: data.dau.toLocaleString(), sub: "DAU" },
              { label: "Weekly active", value: data.wau.toLocaleString(), sub: "WAU" },
              { label: "Monthly active", value: data.mau.toLocaleString(), sub: "MAU" },
              {
                label: "WhatsApp opt-in",
                value: data.profiles.enabled ? `${data.profiles.optInRate}%` : "—",
                sub: data.profiles.enabled ? `${data.profiles.total} profiles` : "needs profiles",
              },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-gray-500">{k.label}</div>
                <div className="text-2xl font-bold text-gray-900">{k.value}</div>
                <div className="mt-1 text-xs text-gray-400">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Signups 14d */}
            <Panel title="Signups · 14 days" wide>
              <div className="p-5">
                <BarChart
                  bars={data.signups14.map((d) => ({
                    label: d.day.slice(8),
                    value: d.value,
                  }))}
                  height="h-36"
                  gap="gap-1.5"
                  showLabels={false}
                />
                <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                  <span>{data.signups14[0]?.day}</span>
                  <span>{data.signups14[data.signups14.length - 1]?.day}</span>
                </div>
              </div>
            </Panel>

            {/* Onboarding funnel */}
            <Panel title="Onboarding funnel">
              {data.events.enabled ? (
                <HBars data={data.events.funnel} color="green" />
              ) : (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Waiting for events.</p>
              )}
            </Panel>

            {/* Documents by type (always available) */}
            <Panel title="Documents by type">
              <HBars data={data.documentsByType} />
            </Panel>

            {/* Users by program */}
            <Panel title="Users by program">
              {data.profiles.enabled ? (
                <HBars data={data.profiles.byProgram} />
              ) : (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Needs profiles.</p>
              )}
            </Panel>

            {/* Where users come from */}
            <Panel title="Where users come from">
              {data.profiles.enabled ? (
                <HBars data={data.profiles.referralSources} color="pink" />
              ) : (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Needs profiles.</p>
              )}
            </Panel>

            {/* Users by semester */}
            <Panel title="Users by semester">
              {data.profiles.enabled ? (
                <HBars data={data.profiles.bySemester.map((s) => ({ label: `Sem ${s.label}`, value: s.value }))} />
              ) : (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Needs profiles.</p>
              )}
            </Panel>

            {/* Top content */}
            <Panel title="Top downloaded content" wide>
              {data.events.enabled ? (
                <HBars data={data.events.topContent} color="green" />
              ) : (
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  Waiting for <code>download</code> events.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
