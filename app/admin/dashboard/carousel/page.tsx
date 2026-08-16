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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const isImageType = type === "image";
  const needsCourse = type === "course_playlist" || type === "course_video";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Home Carousel"
        subtitle="Curate the slides shown in the app's home carousel — images, course playlists or single course videos."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <GalleryHorizontalEnd className="size-5 text-primary" />
              New slide
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Slide type */}
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as SlideType[]).map((t) => {
                const Meta = TYPE_META[t];
                const active = type === t;
                return (
                  <Button
                    key={t}
                    type="button"
                    variant={active ? "default" : "outline"}
                    onClick={() => setType(t)}
                    className="h-auto flex-col gap-1.5 py-3 text-xs"
                  >
                    <Meta.icon className="size-5" />
                    {Meta.label}
                  </Button>
                );
              })}
            </div>

            {needsCourse && (
              <div className="space-y-2">
                <Label>Course*</Label>
                <Select
                  value={courseId}
                  onValueChange={(v) => setCourseId(String(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a course…" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {courses.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No courses yet — add one on the Courses page first.
                  </p>
                )}
              </div>
            )}

            {type === "course_video" && (
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL*</Label>
                <Input
                  id="video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Auto-filled from the selected course — edit if you want a
                  different video. The thumbnail is taken from this URL
                  automatically.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="slide-title">
                {isImageType ? "Caption (optional)" : "Overlay title (optional)"}
              </Label>
              <Input
                id="slide-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  needsCourse ? "Defaults to the course title" : "Shown over the image"
                }
              />
            </div>

            {isImageType && (
              <div className="space-y-2">
                <Label htmlFor="slide-link">Link (optional)</Label>
                <Input
                  id="slide-link"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Tapping this slide in the app opens this link outside the app.
                  Leave blank for a non-clickable banner.
                </p>
              </div>
            )}

            {/* Image upload / URL */}
            <div className="space-y-2">
              <Label>
                {isImageType ? "Image*" : "Thumbnail override (optional)"}
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={uploading}
                  render={<label />}
                  className="cursor-pointer"
                >
                  <Upload />
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
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={toggleLibrary}
                >
                  <Images />
                  {libraryOpen ? "Hide R2 images" : "Choose from R2"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  or paste a URL
                </span>
              </div>

              {/* Existing images already in the R2 carousel/ folder. */}
              {libraryOpen && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Images in R2 (carousel/)
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={loadLibrary}
                      disabled={libraryLoading}
                    >
                      Refresh
                    </Button>
                  </div>
                  {libraryLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Loading images…
                    </p>
                  ) : libraryError ? (
                    <p className="py-4 text-center text-sm text-destructive">
                      {libraryError}
                    </p>
                  ) : library.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
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
                            className={cn(
                              "relative aspect-video overflow-hidden rounded-md border-2 transition",
                              selected
                                ? "border-primary ring-2 ring-ring/40"
                                : "border-transparent hover:border-border"
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt=""
                              className="size-full object-cover"
                            />
                            {selected && (
                              <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                                <Check className="size-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <Input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://pub-….r2.dev/carousel/banner.jpg"
              />
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-32 w-full max-w-xs rounded-lg object-cover"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          disabled={busy || uploading}
          className="w-full"
        >
          {busy ? "Working…" : "Add slide"}
        </Button>
      </form>

      {message && (
        <Alert
          variant={/added|uploaded|success/i.test(message) ? "default" : "destructive"}
          className="mt-6"
        >
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Existing slides */}
      <div className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">
          Slides ({slides.length}) — shown in this order
        </h2>
        <div className="space-y-3">
          {slides.map((slide, i) => {
            const Meta = TYPE_META[slide.slide_type];
            const thumb = thumbFor(slide);
            const label =
              slide.title ||
              slide.youtube_courses?.title ||
              TYPE_META[slide.slide_type].label;
            return (
              <Card key={slide.id} className={cn(!slide.is_active && "opacity-60")}>
                <CardContent className="flex items-center gap-4 p-3">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => move(i, 1)}
                      disabled={busy || i === slides.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown />
                    </Button>
                  </div>

                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{label}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Meta.icon className="size-3.5" />
                      {Meta.label}
                    </p>
                    {slide.slide_type === "image" && slide.link && (
                      <a
                        href={slide.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 flex items-center gap-1 truncate text-xs text-primary hover:underline"
                        title={slide.link}
                      >
                        <ExternalLink className="size-3 shrink-0" />
                        <span className="truncate">{slide.link}</span>
                      </a>
                    )}
                  </div>

                  <Label className="flex items-center gap-2 text-xs">
                    Active
                    <Switch
                      checked={slide.is_active}
                      disabled={busy}
                      onCheckedChange={() => toggleActive(slide)}
                      aria-label="Active"
                    />
                  </Label>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => remove(slide)}
                    disabled={busy}
                    aria-label="Delete"
                  >
                    <Trash2 />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {slides.length === 0 && (
            <p className="text-muted-foreground">No slides yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
