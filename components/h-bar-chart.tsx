"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
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

export type Segment = { label: string; value: number };

/** Row height per category, so the chart grows with the data instead of squashing. */
const ROW_HEIGHT = 30;
const MIN_HEIGHT = 90;

/**
 * Horizontal bar chart for ranked categories (programs, districts, funnel
 * steps, top content). Horizontal because the category names are words, which
 * read straight rather than rotated.
 *
 * Values are direct-labelled at the end of each bar since the category count is
 * small; hover still gives the exact figure with the category repeated.
 */
export default function HBarChart({
  data,
  valueLabel,
  /** Highlight the largest bar and recede the rest. Off for funnels. */
  emphasizeMax = false,
  xLabel,
  yLabel,
}: {
  data: Segment[];
  valueLabel?: string;
  emphasizeMax?: boolean;
  /** Axis titles. The value axis runs horizontally on this chart. */
  xLabel?: string;
  yLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-gray-400">No data yet.</p>
    );
  }

  const max = Math.max(...data.map((d) => d.value));
  const height = Math.max(MIN_HEIGHT, data.length * ROW_HEIGHT);

  return (
    <div className="p-4">
      <ChartContainer height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 44, bottom: xLabel ? 20 : 4, left: yLabel ? 8 : 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID_COLOR}
            strokeDasharray="3 3"
          />
          {/* Visible value scale, so a bar's length has something to mean. */}
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            height={xLabel ? 34 : 18}
            tick={{ fontSize: 10, fill: AXIS_TEXT }}
          >
            {xLabel && (
              <Label
                value={xLabel}
                position="insideBottom"
                offset={-6}
                style={{ fontSize: 11, fill: AXIS_TEXT }}
              />
            )}
          </XAxis>
          <YAxis
            type="category"
            dataKey="label"
            width={112}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: AXIS_TEXT }}
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
          <Bar dataKey="value" radius={[0, 4, 4, 0]} minPointSize={2}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={SERIES_COLOR}
                // Rank emphasis is a lightness step of the same hue, never a
                // different hue — the bars are all the same kind of thing.
                fillOpacity={emphasizeMax && d.value !== max ? 0.55 : 1}
              />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              className="fill-gray-700"
              fontSize={12}
              fontWeight={500}
              formatter={(v: unknown) => Number(v).toLocaleString()}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
