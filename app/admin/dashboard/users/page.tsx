"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

interface Row {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean | null;
  program: string | null;
  faculty: string | null;
  semester: number | null;
  district: string | null;
}
interface Resp {
  total: number;
  profilesEnabled: boolean;
  users: Row[];
}

// Date + time, so Joined / Last seen show the exact moment.
const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

type SortKey =
  | "name"
  | "provider"
  | "program"
  | "whatsapp"
  | "created_at"
  | "last_sign_in_at";

function sortValue(u: Row, key: SortKey): string | number {
  switch (key) {
    case "name":
      return (u.name || u.email || "").toLowerCase();
    case "provider":
      return (u.provider || "").toLowerCase();
    case "program":
      return (u.program || "").toLowerCase();
    case "whatsapp":
      return u.whatsapp_opt_in ? 1 : 0;
    case "created_at":
      return u.created_at || "";
    case "last_sign_in_at":
      return u.last_sign_in_at || "";
  }
}

// Deterministic avatar colour per user, for visual scannability.
const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-purple-600",
  "bg-orange-500",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-indigo-600",
];
const avatarColor = (s: string) =>
  AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initial = (u: Row) => (u.name || u.email || "?").trim().charAt(0).toUpperCase();

/** Real profile photo when available, else a coloured initial. */
function Avatar({ u, size = 36 }: { u: Row; size?: number }) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };
  if (u.avatar_url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={u.avatar_url}
        alt=""
        style={dim}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={dim}
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(
        u.email || u.name || "?"
      )}`}
    >
      {initial(u)}
    </span>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = (q = "") => {
    setLoading(true);
    adminFetch<Resp>("/api/admin/users", { search: q })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    load(search);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const rows = useMemo(() => {
    const list = [...(data?.users || [])];
    list.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, sortKey, sortDir]);

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    return (
      <th className="px-4 py-3">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 transition ${
            active ? "text-gray-800" : "hover:text-gray-700"
          }`}
          title={`Sort by ${label}`}
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </th>
    );
  };

  const exportCsv = () => {
    if (!data) return;
    const cols = [
      "name",
      "email",
      "provider",
      "program",
      "faculty",
      "semester",
      "district",
      "phone",
      "whatsapp_opt_in",
      "joined",
      "last_seen",
    ];
    const esc = (v: unknown) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
    const lines = data.users.map((u) =>
      [
        u.name,
        u.email,
        u.provider,
        u.program,
        u.faculty,
        u.semester,
        u.district,
        u.phone,
        u.whatsapp_opt_in === null ? "" : u.whatsapp_opt_in ? "yes" : "no",
        u.created_at,
        u.last_sign_in_at,
      ]
        .map(esc)
        .join(",")
    );
    const csv = "﻿" + cols.join(",") + "\n" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ctevt-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader
        title="Users"
        subtitle={data ? `${data.total.toLocaleString()} registered users` : "Registered users"}
        actions={
          <div className="flex items-center gap-2">
            <form onSubmit={onSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search email, name…"
                  className="w-56 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </form>
            <button
              onClick={exportCsv}
              disabled={!data || data.users.length === 0}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Export all users as CSV"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {!data?.profilesEnabled && data && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Program / semester / WhatsApp columns fill in once the <code>profiles</code> table exists and the app's
          onboarding is live. Apply the growth migration to enable them.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader label="User" k="name" />
              <SortHeader label="Provider" k="provider" />
              <SortHeader label="Program" k="program" />
              <SortHeader label="WhatsApp" k="whatsapp" />
              <SortHeader label="Joined" k="created_at" />
              <SortHeader label="Last seen" k="last_sign_in_at" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/admin/dashboard/users/${u.id}`)}
                  className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-blue-50/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar u={u} />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{u.name || "—"}</div>
                        <div className="truncate text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{u.provider}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.program ? `${u.program}${u.semester ? ` · Sem ${u.semester}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.whatsapp_opt_in ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        {u.phone || "opted in"}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmt(u.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmt(u.last_sign_in_at)}</td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
