"use client";

import { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Shared chart primitives for the admin panel, in the shadcn/ui chart shape:
 * a sizing container plus a themed tooltip, both thin wrappers over Recharts.
 *
 * Every chart in the panel draws from these so one series reads the same colour
 * everywhere. Colour encodes identity, never which panel a chart sits in — the
 * old hand-rolled bars picked a different hue per panel while each showed a
 * single series, which said "these are different things" about data that isn't.
 */

/** Single-series mark colour. Matches the `primary` token in tailwind.config. */
export const SERIES_COLOR = "#2563eb";

/**
 * Categorical slots, in fixed order — assigned by series identity, never
 * cycled and never re-assigned when a filter changes the series count.
 * Validated for CVD separation and contrast against a white surface; the aqua
 * sits just under 3:1, which is why every panel offers a table view.
 */
export const SERIES_COLORS = ["#2563eb", "#eb6834", "#1baf7a"] as const;

/** De-emphasis ink for "one series is the point, the rest are context". */
export const MUTED_COLOR = "#cbd5e1";

/** Recessive grid / axis ink, matching the shadcn border/muted tokens. */
export const GRID_COLOR = "var(--border)";
export const AXIS_TEXT = "var(--muted-foreground)";

/** Fixed-height responsive wrapper. Recharts needs a definite parent height. */
export function ChartContainer({
  height = 128,
  children,
}: {
  height?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as any}
      </ResponsiveContainer>
    </div>
  );
}

export interface TooltipDatum {
  label: string;
  value: number;
}

/**
 * Tooltip body: the category and its value, in text ink rather than the series
 * colour, with a small colour chip carrying the identity.
 */
export function ChartTooltipContent({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipDatum }>;
  /** Noun after the number, e.g. "signups". */
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      <div className="text-xs font-medium text-muted-foreground">{datum.label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: SERIES_COLOR }}
        />
        <span className="text-sm font-semibold">
          {datum.value.toLocaleString()}
        </span>
        {valueLabel && (
          <span className="text-xs text-muted-foreground">{valueLabel}</span>
        )}
      </div>
    </div>
  );
}

/** Hover backdrop behind the hovered mark. Softer than Recharts' default. */
export const HOVER_CURSOR = { fill: "#2563eb", fillOpacity: 0.06 } as const;
