"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

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
            ? `${data.messages.length} student recording${data.messages.length === 1 ? "" : "s"}`
            : "Student voice notes from AI chat"
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {data && !data.available && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Voice messages will appear here once the{" "}
          <code>ai_chat_messages.audio_url</code> migration is applied and
          students start sending voice notes.
        </div>
      )}

      {loading && <div className="py-10 text-center text-gray-400">Loading…</div>}

      {data?.available && !loading && data.messages.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400 shadow-sm">
          No voice messages yet.
        </div>
      )}

      <div className="space-y-4">
        {data?.messages.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-gray-900">
                {m.user_email || "Unknown user"}
                {m.conversation_title && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    · {m.conversation_title}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">{fmt(m.created_at)}</div>
            </div>
            <audio controls preload="none" src={m.audio_url} className="w-full">
              Your browser can't play this audio.
            </audio>
            {m.transcript && m.transcript !== "[Voice message]" && (
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium text-gray-500">Transcript: </span>
                {m.transcript}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
