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
import { cn } from "@/lib/utils";
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <ListVideo className="size-5 text-primary" />
              New course
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playlist">YouTube playlist link*</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="playlist"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=…"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={fetchDetails}
                  disabled={!linkLooksValid || fetching}
                  className="shrink-0"
                >
                  {fetching ? <Loader2 className="animate-spin" /> : <Search />}
                  Fetch details
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Any link containing <code>?list=</code> works — including a video
                opened from inside the playlist. It is saved as the playlist URL.
              </p>
            </div>

            {thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt=""
                className="h-32 w-56 rounded-lg border object-cover"
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="course-title">Title</Label>
              <Input
                id="course-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Left blank — uses the playlist's own title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-description">Description</Label>
              <Textarea
                id="course-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Shown under the course title in the app"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={busy || !linkLooksValid}
              className="w-full"
            >
              {busy ? "Saving…" : "Add course"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {message && (
        <Alert className="mt-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mt-8 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">In the app ({courses.length})</CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {loading ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : courses.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No courses yet. Paste a playlist link above to publish the first one.
            </p>
          ) : (
            <ul>
              {courses.map((course, index) => (
                <li
                  key={course.id}
                  className={cn(
                    "flex items-start gap-4 px-6 py-4",
                    index < courses.length - 1 && "border-b"
                  )}
                >
                  <div className="flex flex-col gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => move(index, 1)}
                      disabled={busy || index === courses.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    {editId === course.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={busy}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditId("")}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium">{course.title}</p>
                        {course.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {course.description}
                          </p>
                        )}
                        <a
                          href={course.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          Open playlist
                        </a>
                      </>
                    )}
                  </div>

                  {editId !== course.id && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEdit(course)}
                        aria-label="Edit"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => remove(course)}
                        disabled={busy}
                        aria-label="Delete"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
