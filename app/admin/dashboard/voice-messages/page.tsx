"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  id: string;
  transcript: string;
  audio_url: string;
  created_at: string;
  conversation_title: string | null;
  user_email: string | null;
}
interface Resp {
  available: boolean;
  messages: Row[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function VoiceMessagesPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminFetch<Resp>("/api/admin/voice-messages", {})
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Voice messages"
        subtitle={
          data?.available
            ? `${data.messages.length} student recording${
                data.messages.length === 1 ? "" : "s"
              }`
            : "Student voice notes from AI chat"
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && !data.available && (
        <Alert>
          <AlertDescription>
            Voice messages will appear here once the{" "}
            <code>ai_chat_messages.audio_url</code> migration is applied and
            students start sending voice notes.
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {data?.available && !loading && data.messages.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No voice messages yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {data?.messages.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {m.user_email || "Unknown user"}
                  {m.conversation_title && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      · {m.conversation_title}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmt(m.created_at)}
                </div>
              </div>
              <audio controls preload="none" src={m.audio_url} className="w-full">
                Your browser can&apos;t play this audio.
              </audio>
              {m.transcript && m.transcript !== "[Voice message]" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium">Transcript: </span>
                  {m.transcript}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
