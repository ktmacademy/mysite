"use client";

/**
 * Vertical bar chart for small daily series.
 *
 * The bars are absolutely positioned inside a relative track on purpose. A
 * percentage `height` only resolves against a parent with a definite height —
 * inside a shrink-to-fit flex column it resolves to `auto`, which collapses
 * every bar to its `min-height` and makes the chart look empty regardless of
 * the data. Positioning against the track sidesteps that.
 */

export type Bar = { label: string; value: number };

export default function BarChart({
  bars,
  height = "h-32",
  gap = "gap-2",
  showLabels = true,
}: {
  bars: Bar[];
  /** Tailwind height class for the plot area. */
  height?: string;
  gap?: string;
  showLabels?: boolean;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const allZero = bars.every((b) => b.value === 0);

  return (
    <div>
      <div className={`flex ${height} ${gap}`}>
        {bars.map((b, i) => (
          <div
            key={`${b.label}-${i}`}
            className="flex flex-1 flex-col"
            title={`${b.label}: ${b.value}`}
          >
            <div className="relative min-h-0 flex-1">
              {b.value > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-gradient-to-t from-blue-700 to-blue-400"
                  style={{ height: `${(b.value / max) * 100}%`, minHeight: 4 }}
                />
              )}
              {/* Baseline tick, so an empty day still reads as a day. */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gray-200" />
            </div>
            {showLabels && (
              <span className="mt-1 text-center text-[10px] text-gray-400">
                {b.label}
              </span>
            )}
          </div>
        ))}
      </div>
      {allZero && (
        <p className="mt-2 text-center text-xs text-gray-400">
          No activity in this period.
        </p>
      )}
    </div>
  );
}
