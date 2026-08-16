"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { SERIES_COLOR } from "@/components/ui/chart";

/**
 * A single headline number, optionally with the shape behind it.
 *
 * A one-value measure is a stat tile, not a one-bar chart — the sparkline is
 * context for the number, so it carries no axes, no grid and no tooltip.
 */
export default function StatTile({
  label,
  value,
  sub,
  spark,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** Optional trend behind the number. */
  spark?: number[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={spark.map((v, i) => ({ i, v }))}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <Area
                type="monotone"
                dataKey="v"
                stroke={SERIES_COLOR}
                strokeWidth={1.5}
                fill={SERIES_COLOR}
                fillOpacity={0.12}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

/**
 * A single ratio against its limit. A two-slice pie would say the same thing
 * worse, so this is a track with a filled portion and the figure spelled out.
 */
export function Meter({
  label,
  percent,
  caption,
}: {
  label: string;
  percent: number;
  caption?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-2xl font-bold text-gray-900">{clamped}%</span>
      </div>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: SERIES_COLOR }}
        />
      </div>
      {caption && <div className="mt-2 text-xs text-gray-400">{caption}</div>}
    </div>
  );
}
