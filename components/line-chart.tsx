"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  GRID_COLOR,
  AXIS_TEXT,
  SERIES_COLORS,
} from "@/components/charts/chart-tokens";

export interface SeriesDef {
  /** Key into each row of `data`. */
  key: string;
  /** Human name, shown in the legend and tooltip. */
  name: string;
}

/** Crosshair tooltip: every series at the hovered day, largest first. */
function TimeTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  series: SeriesDef[];
}) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-muted-foreground">
              {series.find((s) => s.key === row.dataKey)?.name ?? row.dataKey}
            </span>
            <span className="ml-auto font-semibold">
              {row.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Trend over time. One series renders as a filled area (the shape is the
 * point); two or more render as lines with a legend, since identity matters
 * once there is something to tell apart.
 *
 * Deliberately single-axis: two measures of different scale belong in two
 * charts, never on a second y-axis.
 */
export default function TimeSeriesChart({
  data,
  series,
  height = 200,
  xKey = "day",
}: {
  data: Array<Record<string, any>>;
  series: SeriesDef[];
  height?: number;
  xKey?: string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>;
  }

  const shortDay = (value: string) =>
    typeof value === "string" ? value.slice(5) : value;

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
      <XAxis
        dataKey={xKey}
        tickLine={false}
        axisLine={false}
        minTickGap={24}
        tickFormatter={shortDay}
        tick={{ fontSize: 10, fill: AXIS_TEXT }}
      />
      <YAxis
        width={32}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
        tick={{ fontSize: 10, fill: AXIS_TEXT }}
      />
      <Tooltip content={<TimeTooltip series={series} />} />
    </>
  );

  if (series.length === 1) {
    const only = series[0];
    return (
      <ChartContainer height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`fill-${only.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            type="monotone"
            dataKey={only.key}
            name={only.name}
            stroke={SERIES_COLORS[0]}
            strokeWidth={2}
            fill={`url(#fill-${only.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer height={height}>
      <RechartsLineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        {axes}
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            // Fixed slot by position in `series`, so a series keeps its colour
            // however many others are on screen.
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
}
