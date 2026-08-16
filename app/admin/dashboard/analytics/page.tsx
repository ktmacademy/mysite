"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import ChartPanel from "@/components/chart-panel";
import BarChart from "@/components/bar-chart";
import HBarChart from "@/components/h-bar-chart";
import TimeSeriesChart from "@/components/line-chart";
import StatTile, { Meter } from "@/components/stat-tile";
import HeatmapChart from "@/components/heatmap-chart";
import StackedBarChart from "@/components/stacked-bar-chart";
import { eventLabel } from "@/lib/analytics-events";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Seg {
  label: string;
  value: number;
}
interface Point {
  day: string;
  value: number;
}

interface Resp {
  days: number;
  usersTotal: number;
  dau: number;
  wau: number;
  mau: number;
  eventsInRange: number;
  downloadsInRange: number;
  activeInRange: number;
  signups: Point[];
  cumulativeUsers: Point[];
  activeUsers: Point[];
  engagement: Array<{
    day: string;
    app_open: number;
    screen_view: number;
    download: number;
  }>;
  byHour: Seg[];
  byWeekday: Seg[];
  hourWeekday: { rows: string[]; columns: string[]; values: number[][] };
  documents: {
    total: number;
    byType: Seg[];
    byYear: Seg[];
    byYearType: Array<Record<string, string | number>>;
    types: string[];
  };
  profiles: {
    enabled: boolean;
    total: number;
    optInRate: number;
    onboardedCount: number;
    byProgram: Seg[];
    byFaculty: Seg[];
    bySemester: Seg[];
    byDistrict: Seg[];
    byGoal: Seg[];
    referralSources: Seg[];
  };
  events: {
    enabled: boolean;
    mix: Seg[];
    funnel: Seg[];
    onboardingSteps: Seg[];
    topScreens: Seg[];
    topContent: Seg[];
    downloadsByType: Seg[];
    loginMethods: Seg[];
  };
}

const RANGES = [7, 14, 30, 90];

/** Chart rows -> the [label, value] pairs the panel's table and CSV want. */
const segRows = (segs: Seg[]) => segs.map((s) => [s.label, s.value] as [string, number]);
const pointRows = (points: Point[]) =>
  points.map((p) => [p.day, p.value] as [string, number]);

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function AnalyticsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminFetch<Resp>("/api/admin/analytics", { days: range }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader
        title="Analytics & insights"
        subtitle="Who your users are, when they study, and what they actually open"
        actions={
          <Button variant="outline" size="sm" onClick={() => load(days)}>
            <RefreshCw className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {/* Filters — one row, above every chart they govern. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Range</span>
        <ToggleGroup
          value={[String(days)]}
          onValueChange={(value) => {
            const next = Number(value[0]);
            if (next) setDays(next);
          }}
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r} value={String(r)} size="sm">
              {r}d
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-xs text-muted-foreground">
          Applies to trends, activity and event panels. Segments and the
          catalogue describe all records.
        </span>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!data && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}

      {data && (
        <>
          {(!data.profiles.enabled || !data.events.enabled) && (
            <Alert className="mb-6">
              <AlertDescription>
              Some panels are waiting for data. Segment charts need the{" "}
              <code>profiles</code> table; activity panels need{" "}
              <code>analytics_events</code> to receive events.
              </AlertDescription>
            </Alert>
          )}

          {/* KPI row */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Total users"
              value={data.usersTotal}
              sub={`${data.profiles.onboardedCount} onboarded`}
              spark={data.cumulativeUsers.map((p) => p.value)}
            />
            <StatTile
              label="Active today"
              value={data.dau}
              sub="signed in within 24h"
              spark={data.activeUsers.map((p) => p.value)}
            />
            <StatTile
              label={`Active · ${data.days}d`}
              value={data.activeInRange}
              sub={`${data.wau} weekly · ${data.mau} monthly`}
            />
            <StatTile
              label={`Downloads · ${data.days}d`}
              value={data.downloadsInRange}
              sub={`${data.eventsInRange.toLocaleString()} events tracked`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ---- Growth ---- */}
            <ChartPanel
              title="User growth"
              subtitle={`Running total of accounts over ${data.days} days`}
              wide
              rows={pointRows(data.cumulativeUsers)}
              columns={["Day", "Users"]}
            >
              <div className="p-5">
                <TimeSeriesChart
                  data={data.cumulativeUsers}
                  series={[{ key: "value", name: "Total users" }]}
                  height={200}
                />
              </div>
            </ChartPanel>

            <ChartPanel
              title="New signups"
              subtitle="Accounts created per day"
              rows={pointRows(data.signups)}
              columns={["Day", "Signups"]}
            >
              <div className="p-5">
                <BarChart
                  bars={data.signups.map((p) => ({
                    label: p.day,
                    tick: p.day.slice(8),
                    value: p.value,
                  }))}
                  height={190}
                  showLabels={data.days <= 14}
                  valueLabel="signups"
                  xLabel="Day of month"
                  yLabel="Signups"
                />
              </div>
            </ChartPanel>

            <ChartPanel
              title="Daily active users"
              subtitle="Distinct users sending events each day"
              rows={pointRows(data.activeUsers)}
              columns={["Day", "Active users"]}
            >
              <div className="p-5">
                <TimeSeriesChart
                  data={data.activeUsers}
                  series={[{ key: "value", name: "Active users" }]}
                  height={176}
                />
              </div>
            </ChartPanel>

            {/* ---- Engagement ---- */}
            <ChartPanel
              title="Engagement by day"
              subtitle="App opens, screen views and downloads on one scale"
              wide
              rows={data.engagement.map((e) => [
                e.day,
                e.app_open,
                e.screen_view,
                e.download,
              ])}
              columns={["Day", "App opens", "Screen views", "Downloads"]}
            >
              <div className="p-5">
                <TimeSeriesChart
                  data={data.engagement}
                  series={[
                    { key: "app_open", name: "App opens" },
                    { key: "screen_view", name: "Screen views" },
                    { key: "download", name: "Downloads" },
                  ]}
                  height={220}
                />
              </div>
            </ChartPanel>

            {/* ---- Rhythms ---- */}
            <ChartPanel
              title="When students study · hour"
              subtitle="Events by hour of day, your server's timezone"
              rows={segRows(data.byHour)}
              columns={["Hour", "Events"]}
            >
              <div className="p-5">
                <BarChart
                  bars={data.byHour.map((h) => ({
                    label: `${h.label}:00`,
                    tick: h.label,
                    value: h.value,
                  }))}
                  height={190}
                  valueLabel="events"
                  xLabel="Hour of day"
                  yLabel="Events"
                />
              </div>
            </ChartPanel>

            <ChartPanel
              title="When students study · weekday"
              subtitle="Events by day of the week"
              rows={segRows(data.byWeekday)}
              columns={["Day", "Events"]}
            >
              <div className="p-5">
                <BarChart
                  bars={data.byWeekday.map((d) => ({
                    label: d.label,
                    tick: d.label,
                    value: d.value,
                  }))}
                  height={190}
                  valueLabel="events"
                  xLabel="Weekday"
                  yLabel="Events"
                />
              </div>
            </ChartPanel>

            <ChartPanel
              title="Study rhythm - weekday by hour"
              subtitle="Where the dark cells are is when to publish"
              wide
              rows={data.hourWeekday.rows.flatMap((row, r) =>
                data.hourWeekday.columns.map((col, c) => [
                  row,
                  col + ":00",
                  data.hourWeekday.values[r][c],
                ])
              )}
              columns={["Weekday", "Hour", "Events"]}
            >
              <HeatmapChart
                data={data.hourWeekday}
                rowLabel="Weekday"
                columnLabel="Hour of day"
                valueLabel="events"
              />
            </ChartPanel>

            {/* ---- What they use ---- */}
            <ChartPanel
              title="Most visited screens"
              subtitle="Where attention goes inside the app"
              rows={segRows(data.events.topScreens)}
              columns={["Screen", "Views"]}
            >
              <HBarChart
                data={data.events.topScreens}
                valueLabel="views"
                emphasizeMax
                xLabel="Screen views"
              />
            </ChartPanel>

            <ChartPanel
              title="Event mix"
              subtitle="Which tracked actions happen most"
              rows={data.events.mix.map((s) => [eventLabel(s.label), s.value])}
              columns={["Event", "Count"]}
            >
              <HBarChart
                data={data.events.mix.map((s) => ({
                  label: eventLabel(s.label),
                  value: s.value,
                }))}
                valueLabel="events"
                emphasizeMax
              />
            </ChartPanel>

            <ChartPanel
              title="Top downloaded content"
              subtitle="The documents students actually take"
              wide
              rows={segRows(data.events.topContent)}
              columns={["Document", "Downloads"]}
            >
              <HBarChart
                data={data.events.topContent}
                valueLabel="downloads"
                emphasizeMax
                xLabel="Downloads"
              />
            </ChartPanel>

            <ChartPanel
              title="Downloads by material"
              subtitle="Notes vs past papers vs solutions"
              rows={data.events.downloadsByType.map((s) => [
                titleCase(s.label),
                s.value,
              ])}
              columns={["Type", "Downloads"]}
            >
              <HBarChart
                data={data.events.downloadsByType.map((s) => ({
                  label: titleCase(s.label),
                  value: s.value,
                }))}
                valueLabel="downloads"
                emphasizeMax
              />
            </ChartPanel>

            <ChartPanel
              title="How users sign in"
              rows={data.events.loginMethods.map((s) => [
                titleCase(s.label),
                s.value,
              ])}
              columns={["Method", "Logins"]}
            >
              <HBarChart
                data={data.events.loginMethods.map((s) => ({
                  label: titleCase(s.label),
                  value: s.value,
                }))}
                valueLabel="logins"
              />
            </ChartPanel>

            {/* ---- Onboarding ---- */}
            <ChartPanel
              title="Onboarding funnel"
              subtitle="In flow order, so the drop-off is the shape"
              rows={segRows(data.events.funnel)}
              columns={["Step", "Users"]}
            >
              <HBarChart
                data={data.events.funnel}
                valueLabel="events"
                xLabel="Events recorded"
              />
            </ChartPanel>

            <ChartPanel
              title="Onboarding steps answered"
              subtitle="Which questions people actually fill in"
              rows={data.events.onboardingSteps.map((s) => [
                titleCase(s.label),
                s.value,
              ])}
              columns={["Step", "Answers"]}
            >
              <HBarChart
                data={data.events.onboardingSteps.map((s) => ({
                  label: titleCase(s.label),
                  value: s.value,
                }))}
                valueLabel="answers"
                emphasizeMax
              />
            </ChartPanel>

            {/* ---- Who they are ---- */}
            <ChartPanel
              title="WhatsApp opt-in"
              subtitle={`${data.profiles.total} profiles`}
            >
              <Meter
                label="Opted in to updates"
                percent={data.profiles.optInRate}
                caption={`${Math.round(
                  (data.profiles.optInRate / 100) * data.profiles.total
                )} of ${data.profiles.total} profiles`}
              />
            </ChartPanel>

            <ChartPanel
              title="Users by program"
              rows={segRows(data.profiles.byProgram)}
              columns={["Program", "Users"]}
            >
              <HBarChart
                data={data.profiles.byProgram}
                valueLabel="users"
                emphasizeMax
                xLabel="Users"
              />
            </ChartPanel>

            <ChartPanel
              title="Users by faculty"
              rows={segRows(data.profiles.byFaculty)}
              columns={["Faculty", "Users"]}
            >
              <HBarChart
                data={data.profiles.byFaculty}
                valueLabel="users"
                emphasizeMax
                xLabel="Users"
              />
            </ChartPanel>

            <ChartPanel
              title="Users by semester"
              rows={segRows(data.profiles.bySemester)}
              columns={["Semester", "Users"]}
            >
              <BarChart
                bars={data.profiles.bySemester.map((s) => ({
                  label: `Semester ${s.label}`,
                  tick: s.label,
                  value: s.value,
                }))}
                height={190}
                valueLabel="users"
                xLabel="Semester"
                yLabel="Users"
              />
            </ChartPanel>

            <ChartPanel
              title="Top districts"
              subtitle="Where your students are"
              rows={segRows(data.profiles.byDistrict)}
              columns={["District", "Users"]}
            >
              <HBarChart
                data={data.profiles.byDistrict}
                valueLabel="users"
                emphasizeMax
                xLabel="Users"
              />
            </ChartPanel>

            <ChartPanel
              title="What they came for"
              subtitle="Goal chosen during onboarding"
              rows={data.profiles.byGoal.map((s) => [titleCase(s.label), s.value])}
              columns={["Goal", "Users"]}
            >
              <HBarChart
                data={data.profiles.byGoal.map((s) => ({
                  label: titleCase(s.label),
                  value: s.value,
                }))}
                valueLabel="users"
                emphasizeMax
              />
            </ChartPanel>

            <ChartPanel
              title="Where users come from"
              subtitle="Referral source at signup"
              rows={data.profiles.referralSources.map((s) => [
                titleCase(s.label),
                s.value,
              ])}
              columns={["Source", "Users"]}
            >
              <HBarChart
                data={data.profiles.referralSources.map((s) => ({
                  label: titleCase(s.label),
                  value: s.value,
                }))}
                valueLabel="users"
                emphasizeMax
              />
            </ChartPanel>

            {/* ---- Catalogue ---- */}
            <ChartPanel
              title="Documents by type"
              subtitle={`${data.documents.total} documents published`}
              rows={data.documents.byType.map((s) => [titleCase(s.label), s.value])}
              columns={["Type", "Documents"]}
            >
              <HBarChart
                data={data.documents.byType.map((s) => ({
                  label: titleCase(s.label),
                  value: s.value,
                }))}
                valueLabel="documents"
                emphasizeMax
              />
            </ChartPanel>

            <ChartPanel
              title="Documents by year"
              subtitle="Catalogue coverage across exam years"
              rows={segRows(data.documents.byYear)}
              columns={["Year", "Documents"]}
            >
              <BarChart
                bars={data.documents.byYear.map((s) => ({
                  label: s.label,
                  tick: s.label,
                  value: s.value,
                }))}
                height={190}
                valueLabel="documents"
                xLabel="Exam year"
                yLabel="Documents"
              />
            </ChartPanel>
            <ChartPanel
              title="Catalogue coverage"
              subtitle="Each exam year split by material type"
              wide
              rows={data.documents.byYearType.map((row) => [
                String(row.label),
                ...data.documents.types.map((t) => Number(row[t] ?? 0)),
              ])}
              columns={["Year", ...data.documents.types.map(titleCase)]}
            >
              <div className="p-5">
                <StackedBarChart
                  data={data.documents.byYearType}
                  series={data.documents.types.map((t) => ({
                    key: t,
                    name: titleCase(t),
                  }))}
                  height={220}
                  xLabel="Exam year"
                  yLabel="Documents"
                />
              </div>
            </ChartPanel>
          </div>
        </>
      )}
    </div>
  );
}
