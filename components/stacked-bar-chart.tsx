"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Legend,
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

export interface StackSeries {
  key: string;
  name: string;
}

/** Every segment of the hovered column, plus the column total. */
function StackTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold">
              {p.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 border-t pt-1 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="ml-auto font-semibold">
          {total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/**
 * Part-to-whole across a category: each column is one whole, split by series.
 * A stacked bar rather than a pie per column — comparing heights across columns
 * is something readers can actually do.
 */
export default function StackedBarChart({
  data,
  series,
  height = 200,
  xLabel,
  yLabel,
}: {
  data: Array<Record<string, any>>;
  series: StackSeries[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  if (data.length === 0 || series.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>;
  }

  return (
    <ChartContainer height={height}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, bottom: xLabel ? 18 : 0, left: yLabel ? 8 : 0 }}
        barCategoryGap={4}
      >
        <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: AXIS_TEXT }}
        >
          {xLabel && (
            <Label
              value={xLabel}
              position="insideBottom"
              offset={-12}
              style={{ fontSize: 11, fill: AXIS_TEXT }}
            />
          )}
        </XAxis>
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tick={{ fontSize: 10, fill: AXIS_TEXT }}
        >
          {yLabel && (
            <Label
              value={yLabel}
              angle={-90}
              position="insideLeft"
              style={{ fontSize: 11, fill: AXIS_TEXT, textAnchor: "middle" }}
            />
          )}
        </YAxis>
        <Tooltip cursor={{ fill: "#2563eb", fillOpacity: 0.06 }} content={<StackTooltip />} />
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          iconType="square"
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="a"
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            // 2px of surface between segments keeps the stack readable.
            stroke="var(--card)"
            strokeWidth={2}
            // Only the topmost segment gets the rounded data-end.
            radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
