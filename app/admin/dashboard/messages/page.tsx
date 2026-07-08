"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Inbox, RefreshCw, Send } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";

interface Thread {
  userId: string;
  email: string;
  unread: number;
  lastAt: string;
  preview: string;
  lastSender: string;
}
interface Message {
  id: number;
  user_id: string;
  sender: string;
  body: string | null;
  audio_url: string | null;
  created_at: string;
}

const when = (iso: string) => new Date(iso).toLocaleString();

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = () => {
    setLoadingThreads(true);
    adminFetch<{ enabled: boolean; threads: Thread[] }>("/api/admin/messages", {
      action: "threads",
    })
      .then((r) => {
        setEnabled(r.enabled);
        setThreads(r.threads);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingThreads(false));
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openThread = (t: Thread) => {
    setSelected(t);
    setLoadingThread(true);
    adminFetch<{ messages: Message[] }>("/api/admin/messages", {
      action: "thread",
      userId: t.userId,
    })
      .then((r) => setMessages(r.messages))
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoadingThread(false);
        // Reading a thread clears its unread badge in the list.
        setThreads((prev) =>
          prev.map((x) => (x.userId === t.userId ? { ...x, unread: 0 } : x))
        );
      });
  };

  const sendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await adminFetch("/api/admin/messages", {
        action: "reply",
        userId: selected.userId,
        text: reply,
      });
      setReply("");
      const r = await adminFetch<{ messages: Message[] }>("/api/admin/messages", {
        action: "thread",
        userId: selected.userId,
      });
      setMessages(r.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Messages</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <p className="font-medium text-amber-900">Messaging isn&apos;t enabled yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-800">
            Apply the <code>support_messages</code> migration to receive Contact Us messages from the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-57px)]">
      {/* Thread list */}
      <div
        className={`w-full shrink-0 overflow-y-auto border-r border-gray-200 bg-white md:w-80 ${
          selected ? "hidden md:block" : "block"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-semibold text-gray-900">Messages</span>
          <button
            onClick={loadThreads}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loadingThreads ? "animate-spin" : ""}`} />
          </button>
        </div>
        {threads.length === 0 && !loadingThreads && (
          <p className="p-6 text-center text-sm text-gray-400">No messages yet.</p>
        )}
        {threads.map((t) => (
          <button
            key={t.userId}
            onClick={() => openThread(t)}
            className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${
              selected?.userId === t.userId ? "bg-blue-50" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {(t.email[0] || "?").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-gray-900">{t.email}</span>
                {t.unread > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {t.unread}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-500">
                {t.lastSender === "admin" ? "You: " : ""}
                {t.preview}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Conversation */}
      <div className={`flex flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="font-medium text-gray-900">{selected.email}</span>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
              {loadingThread && <p className="text-center text-sm text-gray-400">Loading…</p>}
              {messages.map((m) => {
                const isAdmin = m.sender === "admin";
                return (
                  <div
                    key={m.id}
                    className={`mb-3 flex ${isAdmin ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2 ${
                        isAdmin
                          ? "rounded-br-sm bg-blue-600 text-white"
                          : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                      }`}
                    >
                      {m.audio_url ? (
                        <audio
                          controls
                          src={m.audio_url}
                          className="max-w-[240px]"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      )}
                      <p className={`mt-1 text-[10px] ${isAdmin ? "text-blue-100" : "text-gray-400"}`}>
                        {when(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <form onSubmit={sendReply} className="flex items-center gap-2 border-t border-gray-200 bg-white p-3">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                title="Send reply"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
