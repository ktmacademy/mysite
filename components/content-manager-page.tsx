"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Calendar, LucideIcon, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

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
      setMessage("Title and description are required");
      return;
    }

    setLoading(true);
    setMessage("");

    const [year, month, day] = selectedDate.split("-").map(Number);
    const [hour, minute] = selectedTime.split(":").map(Number);
    const createdOn = new Date(year, month - 1, day, hour, minute);

    const { error } = await getSupabase().from(table).insert({
      title: title.trim(),
      description: description.trim(),
      link: link.trim(),
      created_on: createdOn.toISOString(),
    });

    if (error) {
      setMessage(`Failed to add ${itemNoun}: ${error.message}`);
    } else {
      setMessage(`${heading} added successfully!`);
      setTitle("");
      setDescription("");
      setLink("");
      await loadItems();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete this ${itemNoun}?`)) return;
    setLoading(true);
    setMessage("");
    try {
      await adminFetch("/api/admin/delete", { table, id });
      setMessage(`${heading} deleted.`);
      await loadItems();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  };

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title={heading} subtitle={`Create and manage ${itemNoun}s`} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="mb-6 flex items-center gap-3">
            <Icon className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">{heading} details</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Title*</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="Enter title"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Description*</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="Enter description"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Link (optional)</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className={inputClass}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="mb-6 flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Time</label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Working..." : `Add ${heading}`}
        </button>
      </form>

      {message && (
        <div
          className={`mt-6 rounded-lg p-4 ${
            message.includes("success") || message.includes("deleted")
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent ({items.length})</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="line-clamp-2 text-sm text-gray-600">{item.description}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(item.created_on).toLocaleString()}
                  {item.link && (
                    <>
                      {" · "}
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        link
                      </a>
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={loading}
                className="shrink-0 rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-gray-500">Nothing here yet.</p>}
        </div>
      </div>
    </div>
  );
}
