"use client";

import { useEffect, useState } from "react";
import { Trash2, MessageSquare } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

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
      <PageHeader
        title="Feedback"
        subtitle={`${items.length} message${items.length === 1 ? "" : "s"}`}
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 size-8 opacity-40" />
            {enabled ? "No feedback yet." : "The feedbacks table isn't available."}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm">{i.feedback}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i.name || "Anonymous"}
                  {i.email ? ` · ${i.email}` : ""} ·{" "}
                  {new Date(i.created_at).toLocaleString()}
                </p>
              </div>
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={() => remove(i.id)}
                aria-label="Delete"
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
