"use client";

import { ReactNode, useState } from "react";
import { BarChart3, Download, Table2 } from "lucide-react";

/**
 * The frame every chart on the dashboard sits in.
 *
 * It carries the two things a chart owes its reader beyond the picture: a table
 * view of the same numbers (which is also what discharges the sub-3:1 contrast
 * warning on the aqua series slot) and a CSV of the rows behind it.
 */
export default function ChartPanel({
  title,
  subtitle,
  rows,
  columns = ["Label", "Value"],
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The plotted numbers, for the table view and the CSV. */
  rows?: Array<Array<string | number>>;
  columns?: string[];
  wide?: boolean;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const hasRows = Boolean(rows && rows.length > 0);

  const downloadCsv = () => {
    if (!rows) return;
    const escape = (cell: string | number) => {
      const text = String(cell);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [columns, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>
          )}
        </div>
        {hasRows && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setShowTable((v) => !v)}
              title={showTable ? "Show chart" : "Show table"}
              aria-label={showTable ? "Show chart" : "Show table"}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              {showTable ? (
                <BarChart3 className="h-4 w-4" />
              ) : (
                <Table2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={downloadCsv}
              title="Download CSV"
              aria-label="Download CSV"
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showTable && hasRows ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    className={`px-5 py-2 font-semibold ${i > 0 ? "text-right" : ""}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows!.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-5 py-2 ${
                        j > 0
                          ? "text-right font-medium text-gray-900"
                          : "text-gray-600"
                      }`}
                    >
                      {typeof cell === "number" ? cell.toLocaleString() : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
