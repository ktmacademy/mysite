"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const initial = (u: Row) =>
  (u.name || u.email || "?").trim().charAt(0).toUpperCase();

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
      <TableHead>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn(
            "inline-flex items-center gap-1 transition",
            active ? "text-foreground" : "hover:text-foreground"
          )}
          title={`Sort by ${label}`}
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )
          ) : (
            <ArrowUpDown className="size-3.5 opacity-40" />
          )}
        </button>
      </TableHead>
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
        subtitle={
          data ? `${data.total.toLocaleString()} registered users` : "Registered users"
        }
        actions={
          <div className="flex items-center gap-2">
            <form onSubmit={onSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search email, name…"
                  className="w-56 pl-9"
                />
              </div>
            </form>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!data || data.users.length === 0}
              title="Export all users as CSV"
            >
              <Download />
              Export CSV
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!data?.profilesEnabled && data && (
        <Alert className="mb-4">
          <AlertDescription>
            Program / semester / WhatsApp columns fill in once the{" "}
            <code>profiles</code> table exists and the app&apos;s onboarding is
            live. Apply the growth migration to enable them.
          </AlertDescription>
        </Alert>
      )}

      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <SortHeader label="User" k="name" />
                <SortHeader label="Provider" k="provider" />
                <SortHeader label="Program" k="program" />
                <SortHeader label="WhatsApp" k="whatsapp" />
                <SortHeader label="Joined" k="created_at" />
                <SortHeader label="Last seen" k="last_sign_in_at" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((u) => (
                  <TableRow
                    key={u.id}
                    onClick={() => router.push(`/admin/dashboard/users/${u.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          {u.avatar_url && (
                            <AvatarImage src={u.avatar_url} referrerPolicy="no-referrer" />
                          )}
                          <AvatarFallback>{initial(u)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium">{u.name || "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {u.provider}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.program
                        ? `${u.program}${u.semester ? ` · Sem ${u.semester}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {u.whatsapp_opt_in ? (
                        <Badge variant="secondary">{u.phone || "opted in"}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmt(u.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmt(u.last_sign_in_at)}
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No users match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
