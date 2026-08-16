/**
 * YouTube link helpers shared by the admin panel and its API routes.
 *
 * Metadata comes from YouTube's public oEmbed endpoint, which needs no API key
 * and works for playlist URLs as well as single videos — enough to prefill a
 * course's title and thumbnail from nothing but a pasted link.
 */

/** Playlist id from any URL carrying a `list=` parameter, else null. */
export function extractPlaylistId(url: string): string | null {
  try {
    const list = new URL(url.trim()).searchParams.get("list");
    return list && list.trim() ? list.trim() : null;
  } catch {
    return null;
  }
}

/** Video id from watch?v=, youtu.be/, embed/ or shorts/ URLs, else null. */
export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const v = u.searchParams.get("v");
    if (v) return v;
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "embed" || p === "shorts");
    return i !== -1 ? parts[i + 1] || null : null;
  } catch {
    return null;
  }
}

/**
 * Canonical `youtube.com/playlist?list=…` form of a playlist link.
 *
 * A link copied from a video that happens to be playing inside a playlist
 * carries both `v=` and `list=`; storing the canonical form means the app opens
 * the playlist itself rather than pinning it to whichever video was open.
 */
export function canonicalPlaylistUrl(url: string): string | null {
  const id = extractPlaylistId(url);
  return id ? `https://www.youtube.com/playlist?list=${id}` : null;
}

/** hqdefault thumbnail for a video link, or null when no id can be read. */
export function thumbnailFor(url: string): string | null {
  const id = extractVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export interface YoutubeMeta {
  title: string;
  author: string;
  thumbnail: string | null;
}

/**
 * Title/channel/thumbnail for a YouTube URL via the keyless oEmbed endpoint.
 * Returns null for private, deleted or otherwise unreadable links — callers
 * treat that as "couldn't autofill", not as a hard failure.
 */
export async function fetchYoutubeMeta(url: string): Promise<YoutubeMeta | null> {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
    url
  )}`;
  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.title) return null;
    return {
      title: String(json.title),
      author: String(json.author_name || ""),
      thumbnail: json.thumbnail_url ? String(json.thumbnail_url) : null,
    };
  } catch {
    return null;
  }
}
