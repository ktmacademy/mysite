"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
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
  children,
}: {
  title: string;
  icon: any;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="font-semibold text-gray-900">{title}</span>
        {count !== undefined && (
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {count}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const Empty = ({ text = "Nothing here." }: { text?: string }) => (
  <p className="text-sm text-gray-400">{text}</p>
);

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    adminFetch<Detail>("/api/admin/user-detail", { userId: id })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <button
        onClick={() => router.push("/admin/dashboard/users")}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </button>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}
      {!data && !error && <div className="text-gray-500">Loading…</div>}

      {data && (
        <>
          {/* Header */}
          <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {data.user.avatar_url && !avatarBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.user.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setAvatarBroken(true)}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                {(data.user.full_name || data.user.email || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">
                {data.user.full_name || "—"}
              </h1>
              <p className="text-sm text-gray-600">{data.user.email}</p>
              <p className="mt-1 text-xs text-gray-400">
                {data.user.provider} · joined {d(data.user.created_at)} · last seen{" "}
                {dt(data.user.last_sign_in_at)}
              </p>
            </div>
          </div>

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
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="font-medium text-gray-900">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <Empty text="No onboarding profile yet." />
              )}
            </Section>

            {/* Activity */}
            <Section title="Activity" icon={Activity} count={data.activity.totalEvents}>
              {data.activity.totalEvents === 0 ? (
                <Empty text="No tracked activity." />
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {data.activity.summary.map((s) => (
                      <span
                        key={s.label}
                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                      >
                        {s.label} · {s.value}
                      </span>
                    ))}
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-500">
                    {data.activity.recent.map((e, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {e.event_name}
                          {e.properties?.title ? ` · ${e.properties.title}` : ""}
                        </span>
                        <span className="shrink-0 text-gray-400">{dt(e.created_at)}</span>
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
                            ? "bg-blue-600 text-white"
                            : "border border-gray-200 bg-gray-50 text-gray-800"
                        }`}
                      >
                        {m.audio_url ? (
                          <audio controls src={m.audio_url} className="max-w-[220px]" />
                        ) : (
                          <span className="whitespace-pre-wrap">{m.body}</span>
                        )}
                        <div
                          className={`mt-1 text-[10px] ${
                            m.sender === "admin" ? "text-blue-100" : "text-gray-400"
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
                  <p className="mb-2 text-xs text-gray-500">
                    {data.ai.messageCount} messages across {data.ai.conversations.length} chats
                  </p>
                  <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                    {data.ai.conversations.map((c: any) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span className="truncate text-gray-800">{c.title}</span>
                        <span className="shrink-0 text-xs text-gray-400">{d(c.updated_at)}</span>
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
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                        {b.item_type}
                      </span>
                      {b.item_url ? (
                        <a
                          href={b.item_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-blue-600 hover:underline"
                        >
                          {b.item_title}
                        </a>
                      ) : (
                        <span className="truncate text-gray-800">{b.item_title}</span>
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
                        className="truncate text-blue-600 hover:underline"
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
                      <span className="truncate text-gray-800">{f.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{f.itemCount} items</span>
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
                <p className="text-sm text-gray-700">
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
                    <li key={i} className="text-gray-700">
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
                      <span className="capitalize text-gray-800">{q.category}</span>
                      <span className="text-gray-500">
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
                    <li key={i} className="text-gray-700">
                      {f.feedback}
                      <span className="ml-1 text-xs text-gray-400">· {d(f.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
