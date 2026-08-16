"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Calendar, LucideIcon, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ContentRow {
  id: string;
  title: string;
  description: string;
  link: string;
  created_on: string;
}

interface ContentManagerPageProps {
  /** Supabase table: notifications | loksewa_details */
  table: string;
  heading: string;
  itemNoun: string;
  icon: LucideIcon;
}

/**
 * Shared admin page for content tables that share the
 * title/description/link/created_on shape: create, list, delete.
 * Rendered inside the dashboard shell (which supplies nav + auth guard).
 */
export default function ContentManagerPage({
  table,
  heading,
  itemNoun,
  icon: Icon,
}: ContentManagerPageProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<ContentRow[]>([]);

  const loadItems = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from(table)
      .select("id, title, description, link, created_on")
      .order("created_on", { ascending: false })
      .limit(25);
    if (!error && data) setItems(data as ContentRow[]);
  }, [table]);

  useEffect(() => {
    const now = new Date();
    setSelectedDate(now.toISOString().split("T")[0]);
    setSelectedTime(now.toTimeString().slice(0, 5));
    loadItems();
  }, [loadItems]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFailed(true);
      setMessage("Title and description are required");
      return;
    }

    setLoading(true);
    setMessage("");
    setFailed(false);

    const [year, month, day] = selectedDate.split("-").map(Number);
    const [hour, minute] = selectedTime.split(":").map(Number);
    const createdOn = new Date(year, month - 1, day, hour, minute);

    // Written through the service role: the panel's cookie session is not a
    // Supabase session, so the anon client has no auth.uid() and RLS blocks it.
    try {
      await adminFetch("/api/admin/content", {
        table,
        title: title.trim(),
        description: description.trim(),
        link: link.trim(),
        created_on: createdOn.toISOString(),
      });
      setMessage(`${heading} added successfully!`);
      setTitle("");
      setDescription("");
      setLink("");
      await loadItems();
    } catch (e) {
      setFailed(true);
      setMessage(
        `Failed to add ${itemNoun}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete this ${itemNoun}?`)) return;
    setLoading(true);
    setMessage("");
    setFailed(false);
    try {
      await adminFetch("/api/admin/delete", { table, id });
      setMessage(`${heading} deleted.`);
      await loadItems();
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title={heading} subtitle={`Create and manage ${itemNoun}s`} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <Icon className="size-5 text-primary" />
              {heading} details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title*</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description*</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Enter description"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Link (optional)</Label>
              <Input
                id="link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <Calendar className="size-5 text-primary" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? "Working…" : `Add ${heading}`}
        </Button>
      </form>

      {message && (
        <Alert variant={failed ? "destructive" : "default"} className="mt-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Recent ({items.length})</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.created_on).toLocaleString()}
                    {item.link && (
                      <>
                        {" · "}
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          link
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => handleDelete(item.id)}
                  disabled={loading}
                  aria-label="Delete"
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && (
            <p className="text-muted-foreground">Nothing here yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
