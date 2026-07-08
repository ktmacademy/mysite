"use client";

import { useEffect, useState } from "react";
import { Download, MessageCircle } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

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
        [i.full_name, i.phone, i.program, i.semester, i.district, i.whatsapp_consent_at]
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

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <PageHeader
        title="WhatsApp"
        subtitle="Users who consented to WhatsApp updates"
        actions={
          data?.enabled && data.items.length > 0 ? (
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          ) : null
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {data && !data.enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <p className="font-medium text-amber-900">WhatsApp opt-ins aren&apos;t enabled yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-800">
            Apply the growth migration (creates the <code>profiles</code> table) and ship the app onboarding that
            captures WhatsApp consent. Opt-ins will then appear here.
          </p>
        </div>
      )}

      {data?.enabled && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">Opted in</div>
              <div className="text-2xl font-bold text-green-600">{data.optIns.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">Total profiles</div>
              <div className="text-2xl font-bold text-gray-900">{data.total.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">Opt-in rate</div>
              <div className="text-2xl font-bold text-gray-900">{rate}%</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Consented</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.user_id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{i.full_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{i.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {i.program ? `${i.program}${i.semester ? ` · Sem ${i.semester}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{i.district || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {i.whatsapp_consent_at ? new Date(i.whatsapp_consent_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No opt-ins yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
