"use client";

import { ReactNode, useState } from "react";
import { BarChart3, Download, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    <Card className={cn("gap-0 py-0", wide && "lg:col-span-2")}>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
        {hasRows && (
          <CardAction className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowTable((v) => !v)}
                    aria-label={showTable ? "Show chart" : "Show table"}
                  >
                    {showTable ? <BarChart3 /> : <Table2 />}
                  </Button>
                }
              />
              <TooltipContent>
                {showTable ? "Show chart" : "Show table"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={downloadCsv}
                    aria-label="Download CSV"
                  >
                    <Download />
                  </Button>
                }
              />
              <TooltipContent>Download CSV</TooltipContent>
            </Tooltip>
          </CardAction>
        )}
      </CardHeader>

      {showTable && hasRows ? (
        <CardContent className="max-h-72 overflow-auto px-0 pb-0">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                {columns.map((c, i) => (
                  <TableHead key={c} className={cn(i > 0 && "text-right")}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows!.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell
                      key={j}
                      className={cn(
                        j > 0 ? "text-right font-medium" : "text-muted-foreground"
                      )}
                    >
                      {typeof cell === "number" ? cell.toLocaleString() : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      ) : (
        <CardContent className="px-0 pb-0">{children}</CardContent>
      )}
    </Card>
  );
}
