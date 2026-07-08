"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Images,
  ListVideo,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminFetch, adminGet } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

type SlideType = "image" | "course_playlist" | "course_video";

interface Course {
  id: string;
  title: string;
  link: string;
}

interface R2Image {
  key: string;
  url: string;
  lastModified: number;
}

interface Slide {
  id: string;
  slide_type: SlideType;
  image_url: string | null;
  title: string | null;
  link: string | null;
  course_id: string | null;
  is_active: boolean;
  sort_order: number;
  youtube_courses?: { title: string | null; link: string | null } | null;
}

/** YouTube video id from watch?v=, youtu.be/, embed/ or shorts/ URLs. */
function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return v;
    if (u.hostname.includes("youtu.be")) {
      const seg = u.pathname.split("/").filter(Boolean)[0];
      return seg || null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "embed" || p === "shorts");
    if (i !== -1 && parts[i + 1]) return parts[i + 1];
    return null;
  } catch {
    return null;
  }
}

function thumbFor(slide: Slide): string | null {
  if (slide.image_url) return slide.image_url;
  const id = extractVideoId(slide.link || "");
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

const TYPE_META: Record<SlideType, { label: string; icon: typeof ImageIcon }> = {
  image: { label: "Image", icon: ImageIcon },
  course_playlist: { label: "Course playlist", icon: ListVideo },
  course_video: { label: "Course video", icon: Video },
};

export default function CarouselPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state
  const [type, setType] = useState<SlideType>("image");
  const [courseId, setCourseId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  // Optional external URL for an image slide; tapping the slide in the app
  // opens this outside the app.
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Existing images already in the R2 carousel/ folder, for reuse.
  const [library, setLibrary] = useState<R2Image[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) || null,
    [courses, courseId]
  );

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [slideRes, courseRes] = await Promise.all([
      sb
        .from("carousel_images")
        .select(
          "id, image_url, slide_type, title, link, course_id, is_active, sort_order, youtube_courses(title, link)"
        )
        .order("sort_order", { ascending: true }),
      sb.from("youtube_courses").select("id, title, link").order("sort_order"),
    ]);
    if (!slideRes.error && slideRes.data) setSlides(slideRes.data as unknown as Slide[]);
    if (!courseRes.error && courseRes.data) setCourses(courseRes.data as Course[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-fetch the URL from the picked course: prefill the Video URL field with
  // the course's stored link (a playlist or a single YouTube link) so the admin
  // doesn't have to paste it by hand. Only for course_video slides.
  useEffect(() => {
    if (type === "course_video" && selectedCourse?.link) {
      setVideoUrl(selectedCourse.link);
    }
  }, [type, selectedCourse]);

  const resetForm = () => {
    setType("image");
    setCourseId("");
    setVideoUrl("");
    setTitle("");
    setImageUrl("");
    setLinkUrl("");
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Auth is the admin session cookie (sent automatically); no bearer token.
      const res = await fetch("/api/admin/r2-upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
      const url = json.url as string;
      setImageUrl(url);
      setMessage("Image uploaded to R2.");
      // Keep the R2 picker in sync so the new upload shows up there too.
      setLibrary((prev) =>
        prev.some((i) => i.url === url)
          ? prev
          : [{ key: json.key as string, url, lastModified: Date.now() }, ...prev]
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setUploading(false);
  };

  const loadLibrary = async () => {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const { images } = await adminGet<{ images: R2Image[] }>(
        "/api/admin/r2-upload"
      );
      setLibrary(images);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : String(e));
    }
    setLibraryLoading(false);
  };

  const toggleLibrary = () => {
    const next = !libraryOpen;
    setLibraryOpen(next);
    // Fetch on first open (and refresh after a new upload adds to the folder).
    if (next && library.length === 0 && !libraryLoading) loadLibrary();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      let payload: Record<string, unknown>;
      if (type === "image") {
        if (!imageUrl.trim()) throw new Error("Upload or paste an image URL first.");
        const trimmedLink = linkUrl.trim();
        if (trimmedLink && !/^https?:\/\//i.test(trimmedLink)) {
          throw new Error("The link must start with http:// or https://");
        }
        payload = {
          slide_type: "image",
          image_url: imageUrl.trim(),
          title: title.trim(),
          link: trimmedLink,
        };
      } else if (type === "course_playlist") {
        if (!selectedCourse) throw new Error("Select a course.");
        payload = {
          slide_type: "course_playlist",
          course_id: selectedCourse.id,
          link: selectedCourse.link,
          title: title.trim() || selectedCourse.title,
          image_url: imageUrl.trim(),
        };
      } else {
        if (!selectedCourse) throw new Error("Select the course this video belongs to.");
        if (!videoUrl.trim()) throw new Error("Paste the video URL.");
        const derived = extractVideoId(videoUrl.trim());
        payload = {
          slide_type: "course_video",
          course_id: selectedCourse.id,
          link: videoUrl.trim(),
          title: title.trim() || selectedCourse.title,
          image_url:
            imageUrl.trim() ||
            (derived ? `https://i.ytimg.com/vi/${derived}/hqdefault.jpg` : ""),
        };
      }

      await adminFetch("/api/admin/carousel", payload);
      setMessage("Slide added.");
      resetForm();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const toggleActive = async (slide: Slide) => {
    setBusy(true);
    try {
      await adminFetch("/api/admin/carousel", { id: slide.id, is_active: !slide.is_active });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const a = slides[index];
    const b = slides[target];
    setBusy(true);
    try {
      // Swap the two rows' sort_order so their display order flips.
      await adminFetch("/api/admin/carousel", { id: a.id, sort_order: b.sort_order });
      await adminFetch("/api/admin/carousel", { id: b.id, sort_order: a.sort_order });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const remove = async (slide: Slide) => {
    if (!window.confirm("Delete this slide?")) return;
    setBusy(true);
    try {
      await adminFetch("/api/admin/delete", { table: "carousel_images", id: slide.id });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";
  const isImageType = type === "image";
  const needsCourse = type === "course_playlist" || type === "course_video";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Home Carousel"
        subtitle="Curate the slides shown in the app's home carousel — images, course playlists or single course videos."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <GalleryHorizontalEnd className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">New slide</h2>
          </div>

          {/* Slide type */}
          <div className="mb-6 grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_META) as SlideType[]).map((t) => {
              const Meta = TYPE_META[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Meta.icon className="h-5 w-5" />
                  {Meta.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {needsCourse && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Course*</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select a course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No courses found. Add courses to the youtube_courses table first.
                  </p>
                )}
              </div>
            )}

            {type === "course_video" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Video URL*
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://www.youtube.com/watch?v=…"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">
                  Auto-filled from the selected course — edit if you want a
                  different video. The thumbnail is taken from this URL
                  automatically.
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {isImageType ? "Caption (optional)" : "Overlay title (optional)"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder={
                  needsCourse ? "Defaults to the course title" : "Shown over the image"
                }
              />
            </div>

            {isImageType && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Link (optional)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://example.com"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Tapping this slide in the app opens this link outside the app.
                  Leave blank for a non-clickable banner.
                </p>
              </div>
            )}

            {/* Image upload / URL */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {isImageType ? "Image*" : "Thumbnail override (optional)"}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : "Upload to R2"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={toggleLibrary}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Images className="h-4 w-4" />
                  {libraryOpen ? "Hide R2 images" : "Choose from R2"}
                </button>
                <span className="text-xs text-gray-400">or paste a URL</span>
              </div>

              {/* Existing images already in the R2 carousel/ folder. */}
              {libraryOpen && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-600">
                      Images in R2 (carousel/)
                    </p>
                    <button
                      type="button"
                      onClick={loadLibrary}
                      disabled={libraryLoading}
                      className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  </div>
                  {libraryLoading ? (
                    <p className="py-6 text-center text-sm text-gray-400">
                      Loading images…
                    </p>
                  ) : libraryError ? (
                    <p className="py-4 text-center text-sm text-red-600">
                      {libraryError}
                    </p>
                  ) : library.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">
                      No images found in the carousel/ folder yet.
                    </p>
                  ) : (
                    <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                      {library.map((img) => {
                        const selected = imageUrl === img.url;
                        return (
                          <button
                            key={img.key}
                            type="button"
                            onClick={() => setImageUrl(img.url)}
                            title={img.key.replace("carousel/", "")}
                            className={`relative aspect-video overflow-hidden rounded-md border-2 transition ${
                              selected
                                ? "border-blue-600 ring-2 ring-blue-200"
                                : "border-transparent hover:border-gray-300"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {selected && (
                              <span className="absolute right-1 top-1 rounded-full bg-blue-600 p-0.5 text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={`${inputClass} mt-3`}
                placeholder="https://pub-….r2.dev/carousel/banner.jpg"
              />
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="preview"
                  className="mt-3 h-32 w-full max-w-xs rounded-lg object-cover"
                />
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || uploading}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Working…" : "Add slide"}
        </button>
      </form>

      {message && (
        <div
          className={`mt-6 rounded-lg p-4 ${
            /added|uploaded|success/i.test(message)
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message}
        </div>
      )}

      {/* Existing slides */}
      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Slides ({slides.length}) — shown in this order
        </h2>
        <div className="space-y-3">
          {slides.map((slide, i) => {
            const Meta = TYPE_META[slide.slide_type];
            const thumb = thumbFor(slide);
            const label =
              slide.title || slide.youtube_courses?.title || TYPE_META[slide.slide_type].label;
            return (
              <div
                key={slide.id}
                className={`flex items-center gap-4 rounded-lg border bg-white p-3 shadow-sm ${
                  slide.is_active ? "border-gray-200" : "border-gray-200 opacity-60"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={busy || i === 0}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={busy || i === slides.length - 1}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-16 w-28 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{label}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                    <Meta.icon className="h-3.5 w-3.5" />
                    {Meta.label}
                  </p>
                  {slide.slide_type === "image" && slide.link && (
                    <a
                      href={slide.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 truncate text-xs text-blue-600 hover:underline"
                      title={slide.link}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{slide.link}</span>
                    </a>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={slide.is_active}
                    disabled={busy}
                    onChange={() => toggleActive(slide)}
                  />
                  Active
                </label>

                <button
                  type="button"
                  onClick={() => remove(slide)}
                  disabled={busy}
                  className="shrink-0 rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            );
          })}
          {slides.length === 0 && <p className="text-gray-500">No slides yet.</p>}
        </div>
      </div>
    </div>
  );
}
