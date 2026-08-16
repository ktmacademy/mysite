"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Inbox, RefreshCw, Send } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Messages</h1>
        <Alert>
          <Inbox />
          <AlertTitle>Messaging isn&apos;t enabled yet</AlertTitle>
          <AlertDescription>
            Apply the <code>support_messages</code> migration to receive Contact
            Us messages from the app.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-57px)]">
      {/* Thread list */}
      <div
        className={cn(
          "w-full shrink-0 border-r bg-card md:w-80",
          selected ? "hidden md:block" : "block"
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">Messages</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={loadThreads}
            aria-label="Refresh"
          >
            <RefreshCw className={loadingThreads ? "animate-spin" : undefined} />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-53px)]">
          {threads.length === 0 && !loadingThreads && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No messages yet.
            </p>
          )}
          {threads.map((t) => (
            <button
              key={t.userId}
              onClick={() => openThread(t)}
              className={cn(
                "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition hover:bg-muted",
                selected?.userId === t.userId && "bg-muted"
              )}
            >
              <Avatar className="size-9">
                <AvatarFallback>{(t.email[0] || "?").toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{t.email}</span>
                  {t.unread > 0 && (
                    <Badge className="ml-auto shrink-0">{t.unread}</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t.lastSender === "admin" ? "You: " : ""}
                  {t.preview}
                </p>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Conversation */}
      <div className={cn("flex flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                onClick={() => setSelected(null)}
                aria-label="Back"
              >
                <ArrowLeft />
              </Button>
              <span className="font-medium">{selected.email}</span>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/40 p-4">
              {loadingThread && (
                <p className="text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              )}
              {messages.map((m) => {
                const isAdmin = m.sender === "admin";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "mb-3 flex",
                      isAdmin ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-4 py-2",
                        isAdmin
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border bg-card"
                      )}
                    >
                      {m.audio_url ? (
                        <audio controls src={m.audio_url} className="max-w-[240px]" />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      )}
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          isAdmin
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {when(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={sendReply}
              className="flex items-center gap-2 border-t bg-card p-3"
            >
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 rounded-full"
              />
              <Button
                type="submit"
                size="icon-lg"
                className="rounded-full"
                disabled={sending || !reply.trim()}
                aria-label="Send reply"
              >
                <Send />
              </Button>
            </form>
          </>
        )}
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="fixed bottom-4 left-1/2 w-auto -translate-x-1/2 shadow-lg"
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
