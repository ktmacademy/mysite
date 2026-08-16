"use client";

import { useEffect, useState } from "react";
import { Download, MessageCircle } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OptIn {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp_consent_at: string | null;
  program: string | null;
  semester: number | null;
  district: string | null;
}
interface Resp {
  enabled: boolean;
  total: number;
  optIns: number;
  items: OptIn[];
}

export default function WhatsAppPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<Resp>("/api/admin/whatsapp", {})
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const header = "name,phone,program,semester,district,consented_at\n";
    const body = data.items
      .map((i) =>
        [
          i.full_name,
          i.phone,
          i.program,
          i.semester,
          i.district,
          i.whatsapp_consent_at,
        ]
          .map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "whatsapp-optins.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const rate = data && data.total ? Math.round((data.optIns / data.total) * 100) : 0;

  const STATS = data
    ? [
        { label: "Opted in", value: data.optIns.toLocaleString() },
        { label: "Total profiles", value: data.total.toLocaleString() },
        { label: "Opt-in rate", value: `${rate}%` },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <PageHeader
        title="WhatsApp"
        subtitle="Users who consented to WhatsApp updates"
        actions={
          data?.enabled && data.items.length > 0 ? (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download />
              Export CSV
            </Button>
          ) : null
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && !data.enabled && (
        <Alert>
          <MessageCircle />
          <AlertTitle>WhatsApp opt-ins aren&apos;t enabled yet</AlertTitle>
          <AlertDescription>
            Apply the growth migration (creates the <code>profiles</code> table)
            and ship the app onboarding that captures WhatsApp consent. Opt-ins
            will then appear here.
          </AlertDescription>
        </Alert>
      )}

      {data?.enabled && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            {STATS.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="py-0">
            <CardContent className="overflow-x-auto px-0">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Consented</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((i) => (
                    <TableRow key={i.user_id}>
                      <TableCell className="font-medium">
                        {i.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.phone || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.program
                          ? `${i.program}${i.semester ? ` · Sem ${i.semester}` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.district || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.whatsapp_consent_at
                          ? new Date(i.whatsapp_consent_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No opt-ins yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
