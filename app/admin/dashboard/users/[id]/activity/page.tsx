"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { describeEvent, eventLabel } from "@/lib/analytics-events";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

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
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push(`/admin/dashboard/users/${userId}`)}
      >
        <ArrowLeft /> Back to user
      </Button>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity className="size-6 text-muted-foreground" />
          Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.user.full_name || data?.user.email || "Loading…"}
          {data ? ` · ${data.total} events` : ""}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No tracked activity.
          </CardContent>
        </Card>
      ) : (
        <>
          {data.summary && data.summary.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {data.summary.map((s) => (
                <Badge key={s.label} variant="secondary">
                  {eventLabel(s.label)} · {s.value}
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-6">
            {groupByDay(events).map(([day, dayEvents]) => (
              <div key={day}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {day}
                </h2>
                <Card className="py-0">
                  <CardContent className="px-0">
                    {dayEvents.map((event, i) => (
                      <div
                        key={`${event.created_at}-${i}`}
                        className={cn(
                          "flex items-start justify-between gap-4 px-5 py-3",
                          i < dayEvents.length - 1 && "border-b"
                        )}
                      >
                        <span className="min-w-0 text-sm">
                          {describeEvent(event.event_name, event.properties)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {time(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {data.hasMore && (
            <Button
              variant="outline"
              size="lg"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-6 w-full"
            >
              {loadingMore
                ? "Loading…"
                : `Load older (${events.length} of ${data.total})`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
