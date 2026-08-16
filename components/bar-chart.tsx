"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Label,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
  GRID_COLOR,
  AXIS_TEXT,
  HOVER_CURSOR,
  SERIES_COLOR,
} from "@/components/ui/chart";

/**
 * `label` is the full name, used in the tooltip. `tick` is the short form for
 * the axis (a day-of-month, say) — the axis has to stay terse, the tooltip
 * doesn't.
 */
export type Bar = { label: string; value: number; tick?: string };

/**
 * Vertical bar chart for a single daily series (signups per day).
 *
 * One series, so there is no legend — the panel title names it — and no number
 * printed on every bar; hover reads the exact value instead.
 */
export default function BarChart({
  bars,
  height = 128,
  showLabels = true,
  valueLabel,
  xLabel,
  yLabel,
}: {
  bars: Bar[];
  height?: number;
  /** Show the category tick under each bar. Off when the axis is too crowded. */
  showLabels?: boolean;
  /** Noun after the number in the tooltip, e.g. "signups". */
  valueLabel?: string;
  /** Axis titles. Name what each axis measures rather than leaving it implied. */
  xLabel?: string;
  yLabel?: string;
}) {
  if (bars.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">No data yet.</p>
    );
  }

  return (
    <ChartContainer height={height}>
      <RechartsBarChart
        data={bars}
        margin={{
          top: 4,
          right: 4,
          bottom: xLabel ? 18 : 0,
          left: yLabel ? 8 : 0,
        }}
        // A 2px surface gap between adjacent fills keeps the bars readable as
        // separate marks rather than one block.
        barCategoryGap={2}
      >
        <CartesianGrid
          vertical={false}
          stroke={GRID_COLOR}
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="tick"
          tickLine={false}
          axisLine={false}
          hide={!showLabels}
          interval="preserveStartEnd"
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
        {/* A visible value axis: bar height is only readable against a scale. */}
        <YAxis
          width={32}
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
        <Tooltip
          cursor={HOVER_CURSOR}
          content={<ChartTooltipContent valueLabel={valueLabel} />}
        />
        <Bar
          dataKey="value"
          fill={SERIES_COLOR}
          // Rounded data-end, square where it meets the baseline.
          radius={[4, 4, 0, 0]}
          minPointSize={2}
        />
      </RechartsBarChart>
    </ChartContainer>
  );
}
