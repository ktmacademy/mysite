"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  ChevronRight,
  MessageSquare,
  Bot,
  Bookmark,
  BookOpen,
  FolderOpen,
  PlayCircle,
  MessagesSquare,
  HelpCircle,
  Inbox,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { describeEvent, eventLabel } from "@/lib/analytics-events";
import {
  AiConversationModal,
  type AiConversation,
} from "@/components/ai-conversation-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Detail {
  user: {
    id: string;
    email: string;
    provider: string;
    created_at: string;
    last_sign_in_at: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  profile: Record<string, any> | null;
  activity: { totalEvents: number; summary: { label: string; value: number }[]; recent: any[] };
  support: any[];
  ai: { conversations: any[]; messages: any[]; messageCount: number };
  bookmarks: any[];
  quiz: any[];
  courses: any[];
  folders: any[];
  progress: { total: number; completed: number; items: any[] };
  chats: any[];
  feedback: any[];
}

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

const PROFILE_FIELDS: [string, string][] = [
  ["full_name", "Name"],
  ["phone", "Phone"],
  ["whatsapp_opt_in", "WhatsApp"],
  ["program", "Program"],
  ["faculty", "Faculty"],
  ["semester", "Semester"],
  ["district", "District"],
  ["goal", "Goal"],
  ["referral_source", "Heard via"],
  ["onboarded_at", "Onboarded"],
  ["last_active_at", "Last active"],
];

function Section({
  title,
  icon: Icon,
  count,
  action,
  children,
}: {
  title: string;
  icon: any;
  count?: number;
  /** Optional control shown at the right of the header, e.g. "View details". */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {count !== undefined && <Badge variant="secondary">{count}</Badge>}
          {action}
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

const Empty = ({ text = "Nothing here." }: { text?: string }) => (
  <p className="text-sm text-muted-foreground">{text}</p>
);

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  // The AI conversation whose transcript is open in the viewer, if any.
  const [openChat, setOpenChat] = useState<AiConversation | null>(null);

  useEffect(() => {
    adminFetch<Detail>("/api/admin/user-detail", { userId: id })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/admin/dashboard/users")}
      >
        <ArrowLeft /> Back to users
      </Button>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!data && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Header */}
          <Card className="mb-6">
            <CardContent className="flex items-center gap-4 p-5">
              <Avatar className="size-16">
                {data.user.avatar_url && (
                  <AvatarImage
                    src={data.user.avatar_url}
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="text-2xl font-bold">
                  {(data.user.full_name || data.user.email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-xl font-bold">{data.user.full_name || "—"}</h1>
                <p className="text-sm text-muted-foreground">{data.user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.user.provider} · joined {d(data.user.created_at)} · last
                  seen {dt(data.user.last_sign_in_at)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Onboarding / profile */}
            <Section title="Onboarding profile" icon={Inbox}>
              {data.profile ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {PROFILE_FIELDS.map(([key, label]) => {
                    const v = data.profile![key];
                    if (v === null || v === undefined || v === "") return null;
                    const display =
                      key === "whatsapp_opt_in"
                        ? v
                          ? "Opted in"
                          : "No"
                        : /_at$/.test(key)
                        ? dt(v)
                        : String(v);
                    return (
                      <div key={key} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium text-foreground">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <Empty text="No onboarding profile yet." />
              )}
            </Section>

            {/* Activity */}
            <Section
              title="Activity"
              icon={Activity}
              count={data.activity.totalEvents}
              action={
                data.activity.totalEvents > 0 ? (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      router.push(`/admin/dashboard/users/${data.user.id}/activity`)
                    }
                  >
                    View details <ChevronRight />
                  </Button>
                ) : undefined
              }
            >
              {data.activity.totalEvents === 0 ? (
                <Empty text="No tracked activity." />
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {data.activity.summary.map((s) => (
                      <span
                        key={s.label}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                      >
                        {eventLabel(s.label)} · {s.value}
                      </span>
                    ))}
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {data.activity.recent.map((e, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {describeEvent(e.event_name, e.properties)}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{dt(e.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>

            {/* Contact Us messages */}
            <Section title="Contact Us messages" icon={MessageSquare} count={data.support.length}>
              {data.support.length === 0 ? (
                <Empty text="No messages." />
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {data.support.map((m: any) => (
                    <div
                      key={m.id}
                      className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          m.sender === "admin"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-muted text-foreground"
                        }`}
                      >
                        {m.audio_url ? (
                          <audio controls src={m.audio_url} className="max-w-[220px]" />
                        ) : (
                          <span className="whitespace-pre-wrap">{m.body}</span>
                        )}
                        <div
                          className={`mt-1 text-[10px] ${
                            m.sender === "admin" ? "text-blue-100" : "text-muted-foreground"
                          }`}
                        >
                          {dt(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* AI chats */}
            <Section title="AI chats" icon={Bot} count={data.ai.conversations.length}>
              {data.ai.conversations.length === 0 ? (
                <Empty text="No AI conversations." />
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {data.ai.messageCount} messages across {data.ai.conversations.length} chats ·
                    click one to read it
                  </p>
                  <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                    {data.ai.conversations.map((c: any) => (
                      <li key={c.id}>
                        <button
                          onClick={() => setOpenChat(c as AiConversation)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <MessagesSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-foreground group-hover:text-blue-700">
                              {c.title || "Untitled chat"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{d(c.updated_at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            {/* Bookmarks / saved notes */}
            <Section title="Saved notes & bookmarks" icon={Bookmark} count={data.bookmarks.length}>
              {data.bookmarks.length === 0 ? (
                <Empty text="No bookmarks." />
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {data.bookmarks.map((b: any, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {b.item_type}
                      </span>
                      {b.item_url ? (
                        <a
                          href={b.item_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-primary hover:underline"
                        >
                          {b.item_title}
                        </a>
                      ) : (
                        <span className="truncate text-foreground">{b.item_title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Courses saved */}
            <Section title="Courses saved" icon={BookOpen} count={data.courses.length}>
              {data.courses.length === 0 ? (
                <Empty text="No saved courses." />
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {data.courses.map((c: any, i: number) => (
                    <li key={i}>
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary hover:underline"
                      >
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Folders */}
            <Section title="Study folders" icon={FolderOpen} count={data.folders.length}>
              {data.folders.length === 0 ? (
                <Empty text="No folders." />
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.folders.map((f: any) => (
                    <li key={f.id} className="flex justify-between gap-2">
                      <span className="truncate text-foreground">{f.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{f.itemCount} items</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Course progress */}
            <Section title="Course progress" icon={PlayCircle} count={data.progress.total}>
              {data.progress.total === 0 ? (
                <Empty text="No watch history." />
              ) : (
                <p className="text-sm">
                  Watched <b>{data.progress.total}</b> videos ·{" "}
                  <b>{data.progress.completed}</b> completed
                </p>
              )}
            </Section>

            {/* Community chats */}
            <Section title="Community chat" icon={MessagesSquare} count={data.chats.length}>
              {data.chats.length === 0 ? (
                <Empty text="No community messages." />
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                  {data.chats.map((c: any, i: number) => (
                    <li key={i}>
                      {c.message || (c.uploaded_image_url ? "📷 image" : "")}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Quiz results */}
            <Section title="Quiz results" icon={HelpCircle} count={data.quiz.length}>
              {data.quiz.length === 0 ? (
                <Empty text="No quizzes taken." />
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.quiz.map((q: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="capitalize text-foreground">{q.category}</span>
                      <span className="text-muted-foreground">
                        {q.score}/{q.total} · {d(q.completed_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Feedback */}
            <Section title="Feedback" icon={MessageSquare} count={data.feedback.length}>
              {data.feedback.length === 0 ? (
                <Empty text="No feedback." />
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.feedback.map((f: any, i: number) => (
                    <li key={i}>
                      {f.feedback}
                      <span className="ml-1 text-xs text-muted-foreground">· {d(f.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {openChat && (
            <AiConversationModal
              userId={id}
              conversation={openChat}
              onClose={() => setOpenChat(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
