"use client";

import { useState } from "react";

/**
 * Magnitude across a grid (weekday × hour). A heatmap, not a chart with marks:
 * two categorical axes and one measure is exactly the case the form heuristic
 * hands to a heatmap.
 *
 * Sequential single hue, light → dark, lightness strictly decreasing. Never a
 * rainbow: more-is-darker is the only thing the reader has to learn.
 */
const RAMP = [
  "#f1f5f9", // 0 — empty, reads as surface
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8", // densest
];

export interface HeatmapData {
  rows: string[];
  columns: string[];
  values: number[][];
}

export default function HeatmapChart({
  data,
  rowLabel,
  columnLabel,
  valueLabel = "events",
}: {
  data: HeatmapData;
  rowLabel: string;
  columnLabel: string;
  valueLabel?: string;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const max = Math.max(1, ...data.values.flat());
  const total = data.values.flat().reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>;
  }

  /** Bucket a value onto the ramp. Zero always takes the empty step. */
  const step = (v: number) =>
    v === 0 ? 0 : 1 + Math.min(RAMP.length - 2, Math.floor((v / max) * (RAMP.length - 1)));

  const active = hover ? data.values[hover.r][hover.c] : null;

  return (
    <div className="p-5">
      {/* Axis titles sit outside the grid so the cells stay square-ish. */}
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {columnLabel}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {/* Column ticks — every third hour, so they don't collide. */}
          <div className="mb-1 flex gap-[2px] pl-10">
            {data.columns.map((c, i) => (
              <div
                key={c}
                className="flex-1 text-center text-[9px] leading-none text-muted-foreground"
              >
                {i % 3 === 0 ? c : ""}
              </div>
            ))}
          </div>

          {data.rows.map((row, r) => (
            <div key={row} className="mb-[2px] flex items-center gap-[2px]">
              <div className="w-10 shrink-0 pr-1 text-right text-[10px] text-muted-foreground">
                {row}
              </div>
              {data.columns.map((col, c) => {
                const value = data.values[r][c];
                const isHover = hover?.r === r && hover?.c === c;
                return (
                  <div
                    key={col}
                    onMouseEnter={() => setHover({ r, c })}
                    onMouseLeave={() => setHover(null)}
                    title={`${row} ${col}:00 · ${value} ${valueLabel}`}
                    className="h-6 flex-1 rounded-[3px] transition"
                    style={{
                      backgroundColor: RAMP[step(value)],
                      // A 2px surface gap plus a ring on the hovered cell, so
                      // the highlight reads without moving anything.
                      boxShadow: isHover
                        ? "0 0 0 2px var(--card), 0 0 0 3px var(--ring)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}

          <div className="mt-1 pl-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {rowLabel}
          </div>
        </div>
      </div>

      {/* Readout + ramp legend. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {hover ? (
            <>
              <span className="font-medium text-foreground">
                {data.rows[hover.r]} · {data.columns[hover.c]}:00
              </span>{" "}
              — {active!.toLocaleString()} {valueLabel}
            </>
          ) : (
            <span>Hover a cell for its exact count</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">0</span>
          {RAMP.map((color) => (
            <span
              key={color}
              className="h-3 w-4 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="text-[10px] text-muted-foreground">{max}</span>
        </div>
      </div>
    </div>
  );
}
