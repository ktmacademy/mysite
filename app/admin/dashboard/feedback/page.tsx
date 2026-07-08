"use client";

import { useEffect, useState } from "react";
import { Trash2, MessageSquare } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

interface Item {
  id: string;
  name: string | null;
  email: string | null;
  feedback: string;
  created_at: string;
}

export default function FeedbackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    adminFetch<{ enabled: boolean; items: Item[] }>("/api/admin/feedback", {})
      .then((r) => {
        setEnabled(r.enabled);
        setItems(r.items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this feedback?")) return;
    try {
      await adminFetch("/api/admin/delete", { table: "feedbacks", id });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Feedback" subtitle={`${items.length} message${items.length === 1 ? "" : "s"}`} />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {loading && <div className="text-gray-500">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500 shadow-sm">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          {enabled ? "No feedback yet." : "The feedbacks table isn't available."}
        </div>
      )}

      <div className="space-y-3">
        {items.map((i) => (
          <div
            key={i.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm text-gray-800">{i.feedback}</p>
              <p className="mt-1 text-xs text-gray-400">
                {i.name || "Anonymous"}
                {i.email ? ` · ${i.email}` : ""} · {new Date(i.created_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => remove(i.id)}
              className="shrink-0 rounded-lg p-2 text-red-500 transition hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
