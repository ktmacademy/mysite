"use client";

import { useEffect, useState, Fragment } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-api";

/**
 * Read-only viewer for a user's AI chat transcript, mirroring the app's chat
 * interface: user turns are right-aligned on the brand gradient, AI turns sit
 * left behind the gradient spark avatar with rendered Markdown, page-citation
 * chips and a voice-note player. See the Flutter `ChatBubble` widget — the two
 * should stay visually in step.
 */

export interface AiMessage {
  id: string;
  content: string | null;
  is_user: boolean;
  created_at: string;
  audio_url?: string | null;
  sources?: any[] | null;
}

export interface AiConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** The app's AppColors.primaryGradient (#1565C0 → #42A5F5). */
const GRADIENT = "linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ordinal = (day: number) => {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
};

/** "Today" / "Yesterday" / "5 days ago" / "2nd March 2026" — matches the app. */
function dateBucket(iso: string): string {
  const t = new Date(iso);
  const now = new Date();
  const a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return `${ordinal(t.getDate())} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
}

/** "14:05", as on the app's bubbles. */
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ------------------------------ Markdown ------------------------------- */

/** Inline Markdown: `code`, **bold**, *italic*, [text](url). */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Ordered so code wins over emphasis, and ** is tried before *.
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      const safe = /^https?:\/\//i.test(href);
      nodes.push(
        safe ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        )
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * A deliberately small Markdown renderer — headings, lists, quotes, fenced
 * code and the inline set above. It builds React nodes (never raw HTML), so a
 * user-authored message cannot inject markup.
 */
function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: string[] | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i} className="ml-4 list-outside">
        {inline(it, `l${key}-${i}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`b${key++}`} className="my-1 list-decimal space-y-0.5 pl-4">{items}</ol>
      ) : (
        <ul key={`b${key++}`} className="my-1 list-disc space-y-0.5 pl-4">{items}</ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim().startsWith("```")) {
      if (fence) {
        blocks.push(
          <pre
            key={`b${key++}`}
            className="my-1.5 overflow-x-auto rounded-lg bg-black/10 p-2 font-mono text-[0.8em] leading-relaxed"
          >
            {fence.join("\n")}
          </pre>
        );
        fence = null;
      } else {
        flushList();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(raw);
      continue;
    }

    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const size = level <= 1 ? "text-base" : level === 2 ? "text-[0.95rem]" : "text-sm";
      blocks.push(
        <p key={`b${key++}`} className={`mt-2 mb-1 font-bold ${size}`}>
          {inline(heading[2], `h${key}`)}
        </p>
      );
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(numbered[1]);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushList();
      blocks.push(
        <blockquote key={`b${key++}`} className="my-1 border-l-2 border-current/30 pl-2 opacity-80">
          {inline(quote[1], `q${key}`)}
        </blockquote>
      );
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line.trim())) {
      flushList();
      blocks.push(<hr key={`b${key++}`} className="my-2 border-current/20" />);
      continue;
    }

    flushList();
    blocks.push(
      <p key={`b${key++}`} className="my-0.5 whitespace-pre-wrap">
        {inline(line, `p${key}`)}
      </p>
    );
  }
  flushList();
  if (fence) {
    blocks.push(
      <pre key={`b${key++}`} className="my-1.5 overflow-x-auto rounded-lg bg-black/10 p-2 font-mono text-[0.8em]">
        {fence.join("\n")}
      </pre>
    );
  }

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}

/* ------------------------------- Bubbles -------------------------------- */

/** The assistant's gradient spark disc — the app's AiAvatar. */
const AiAvatar = ({ size = 32 }: { size?: number }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-full text-white shadow-sm"
    style={{ width: size, height: size, background: GRADIENT }}
  >
    <Sparkles className="h-[55%] w-[55%]" />
  </span>
);

function Bubble({ message }: { message: AiMessage }) {
  const isUser = message.is_user;
  const sources = Array.isArray(message.sources) ? message.sources : [];
  const content = message.content ?? "";

  return (
    <div className={`flex gap-2 px-1 py-1 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <AiAvatar />}
      <div
        className={`max-w-[80%] rounded-2xl border px-3.5 py-2.5 ${
          isUser
            ? "border-white/25 text-white"
            : "bg-muted text-foreground"
        }`}
        style={isUser ? { background: GRADIENT } : undefined}
      >
        {message.audio_url ? (
          <audio controls src={message.audio_url} className="max-w-[240px]" />
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        ) : (
          <Markdown text={content} />
        )}

        {!isUser && sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {sources.map((s: any, i: number) => (
              <span
                key={i}
                className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border"
                title={s?.snippet || undefined}
              >
                {s?.doc_title || s?.docTitle
                  ? `${s.doc_title ?? s.docTitle} · p.${s.page ?? "?"}`
                  : `Page ${s?.page ?? "?"}`}
              </span>
            ))}
          </div>
        )}

        <div
          className={cn(
            "mt-1 text-[10px]",
            isUser ? "text-white/80" : "text-muted-foreground"
          )}
        >
          {clock(message.created_at)}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Modal --------------------------------- */

export function AiConversationModal({
  userId,
  conversation,
  onClose,
}: {
  userId: string;
  conversation: AiConversation;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AiMessage[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setMessages(null);
    setError("");
    adminFetch<{ messages: AiMessage[] }>("/api/admin/ai-conversation", {
      userId,
      conversationId: conversation.id,
    })
      .then((r) => alive && setMessages(r.messages ?? []))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [userId, conversation.id]);

  // Escape closes, matching the other admin dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let lastBucket = "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
          <AiAvatar size={36} />
          <div className="min-w-0">
            <DialogTitle className="truncate">
              {conversation.title || "Untitled chat"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {messages ? `${messages.length} messages · ` : ""}
              last active {new Date(conversation.updated_at).toLocaleString()}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!messages && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading conversation…
            </div>
          )}
          {messages?.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              This conversation has no messages.
            </p>
          )}
          {messages?.map((m) => {
            const bucket = dateBucket(m.created_at);
            const showHeader = bucket !== lastBucket;
            lastBucket = bucket;
            return (
              <Fragment key={m.id}>
                {showHeader && (
                  <div className="px-1 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {bucket}
                  </div>
                )}
                <Bubble message={m} />
              </Fragment>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
