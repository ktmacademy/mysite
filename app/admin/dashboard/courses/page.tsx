"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ListVideo,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { adminFetch, adminGet } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { extractPlaylistId } from "@/lib/youtube";

interface Course {
  id: string;
  title: string;
  description: string | null;
  link: string;
  sort_order: number;
  created_on: string | null;
}

interface Preview {
  link: string;
  title: string;
  description: string;
  thumbnail: string | null;
}

const inputClass =
  "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // New-course form
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  // Inline edit of an existing row
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = useCallback(async () => {
    try {
      const { courses } = await adminGet<{ courses: Course[] }>(
        "/api/admin/courses"
      );
      setCourses(courses);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setLink("");
    setTitle("");
    setDescription("");
    setThumbnail(null);
  };

  /** Ask YouTube for the playlist's title/thumbnail and prefill the form. */
  const fetchDetails = async () => {
    setFetching(true);
    setError("");
    setMessage("");
    try {
      const preview = await adminFetch<Preview>("/api/admin/courses", {
        action: "preview",
        link,
      });
      setLink(preview.link);
      setTitle(preview.title);
      setDescription(preview.description);
      setThumbnail(preview.thumbnail);
      setMessage("Playlist found — check the details, then add it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setFetching(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Title and description are optional here: the server falls back to the
      // playlist's own metadata when either is left blank.
      await adminFetch("/api/admin/courses", { link, title, description });
      setMessage("Course added to the app.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const startEdit = (course: Course) => {
    setEditId(course.id);
    setEditTitle(course.title);
    setEditDescription(course.description || "");
  };

  const saveEdit = async () => {
    setBusy(true);
    setError("");
    try {
      await adminFetch("/api/admin/courses", {
        id: editId,
        title: editTitle,
        description: editDescription,
      });
      setEditId("");
      setMessage("Course updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= courses.length) return;
    const a = courses[index];
    const b = courses[target];
    setBusy(true);
    try {
      // Swap the two rows' sort_order so their order in the app flips.
      await adminFetch("/api/admin/courses", { id: a.id, sort_order: b.sort_order });
      await adminFetch("/api/admin/courses", { id: b.id, sort_order: a.sort_order });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const remove = async (course: Course) => {
    if (!window.confirm(`Delete "${course.title}" from the app's courses?`)) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/delete", {
        table: "youtube_courses",
        id: course.id,
      });
      setMessage("Course deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const linkLooksValid = Boolean(extractPlaylistId(link));

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Courses"
        subtitle="Publish a YouTube playlist as a course in the app's Courses section."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <ListVideo className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">New course</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                YouTube playlist link*
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=…"
                  className={inputClass}
                  required
                />
                <button
                  type="button"
                  onClick={fetchDetails}
                  disabled={!linkLooksValid || fetching}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {fetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Fetch details
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Any link containing <code>?list=</code> works — including a video
                opened from inside the playlist. It is saved as the playlist URL.
              </p>
            </div>

            {thumbnail && (
              <img
                src={thumbnail}
                alt=""
                className="h-32 w-56 rounded-lg border border-gray-200 object-cover"
              />
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Left blank — uses the playlist's own title"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Shown under the course title in the app"
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !linkLooksValid}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add course"}
          </button>
        </div>
      </form>

      {message && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            In the app ({courses.length})
          </h2>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">
            No courses yet. Paste a playlist link above to publish the first one.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {courses.map((course, index) => (
              <li key={course.id} className="flex items-start gap-4 px-6 py-4">
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={busy || index === 0}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={busy || index === courses.length - 1}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  {editId === course.id ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={busy}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId("")}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900">{course.title}</p>
                      {course.description && (
                        <p className="mt-0.5 text-sm text-gray-600">
                          {course.description}
                        </p>
                      )}
                      <a
                        href={course.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open playlist
                      </a>
                    </>
                  )}
                </div>

                {editId !== course.id && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(course)}
                      className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(course)}
                      disabled={busy}
                      className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
