"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { describeEvent, eventLabel } from "@/lib/analytics-events";

interface ActivityEvent {
  event_name: string;
  properties: Record<string, any> | null;
  created_at: string;
}

interface ActivityResponse {
  user: { id: string; email: string; full_name: string | null };
  total: number;
  events: ActivityEvent[];
  hasMore: boolean;
  summary?: { label: string; value: number }[];
}

const PAGE_SIZE = 100;

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

/** Day heading for a timestamp: "Today", "Yesterday", or the full date. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Groups events into consecutive same-day runs, preserving order. */
function groupByDay(events: ActivityEvent[]): Array<[string, ActivityEvent[]]> {
  const groups: Array<[string, ActivityEvent[]]> = [];
  for (const event of events) {
    const label = dayLabel(event.created_at);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(event);
    else groups.push([label, [event]]);
  }
  return groups;
}

export default function UserActivityPage() {
  const params = useParams();
  const router = useRouter();
  const userId = String(params.id || "");

  const [data, setData] = useState<ActivityResponse | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch<ActivityResponse>("/api/admin/user-activity", {
        userId,
        offset: 0,
        limit: PAGE_SIZE,
      });
      setData(res);
      setEvents(res.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  const loadMore = async () => {
    if (!data) return;
    setLoadingMore(true);
    try {
      const res = await adminFetch<ActivityResponse>("/api/admin/user-activity", {
        userId,
        offset: events.length,
        limit: PAGE_SIZE,
      });
      setEvents((prev) => [...prev, ...res.events]);
      // Keep the first page's summary; later pages don't carry one.
      setData((prev) => (prev ? { ...prev, hasMore: res.hasMore } : res));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoadingMore(false);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <button
        onClick={() => router.push(`/admin/dashboard/users/${userId}`)}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to user
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Activity className="h-6 w-6 text-gray-400" />
            Activity
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {data?.user.full_name || data?.user.email || "Loading…"}
            {data ? ` · ${data.total} events` : ""}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !data || data.total === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          No tracked activity.
        </p>
      ) : (
        <>
          {data.summary && data.summary.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {data.summary.map((s) => (
                <span
                  key={s.label}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  {eventLabel(s.label)} · {s.value}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-6">
            {groupByDay(events).map(([day, dayEvents]) => (
              <div key={day}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  {day}
                </h2>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {dayEvents.map((event, i) => (
                    <div
                      key={`${event.created_at}-${i}`}
                      className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-3 last:border-b-0"
                    >
                      <span className="min-w-0 text-sm text-gray-800">
                        {describeEvent(event.event_name, event.properties)}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {time(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {data.hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-6 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore
                ? "Loading…"
                : `Load older (${events.length} of ${data.total})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
