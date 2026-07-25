// Server-only helper: fetches the LIVE Google Play listing for the CTEVT Plus
// app and parses out the fields rendered on the public /app download page.
//
// The whole point of doing this on the server (instead of hardcoding numbers)
// is that the app icon and install count stay "real-time": Next.js ISR
// re-fetches Play at most every `revalidate` seconds, so the page always shows
// the current logo and download count without hammering Google on each request.

export interface PlayStoreApp {
  appId: string;
  url: string;
  name: string;
  developer: string;
  summary: string;
  icon: string; // high-res icon URL
  category: string; // e.g. "Education"
  contentRating: string; // e.g. "Everyone"
  released: string | null; // e.g. "Oct 17, 2023"
  downloads: string; // Play's public string, e.g. "5,000+"
  downloadsShort: string; // e.g. "5K+"
  installs: number | null; // best-effort exact install count
  score: number | null; // star rating, if Play exposes one yet
  live: boolean; // true if the numbers came from a fresh fetch (not fallback)
}

export const APP_ID = "com.one.ctevt_plus";
const PLAY_URL = `https://play.google.com/store/apps/details?id=${APP_ID}&hl=en&gl=US`;

// Last-known-good values. Used only if the live fetch/parse ever fails, so the
// page renders something sensible instead of breaking. Refreshed automatically
// whenever the live fetch succeeds.
const FALLBACK: PlayStoreApp = {
  appId: APP_ID,
  url: `https://play.google.com/store/apps/details?id=${APP_ID}`,
  name: "CTEVT Plus",
  developer: "Jeevan Koiri",
  summary: "Notes, Past Questions and Syllabus",
  icon: "https://play-lh.googleusercontent.com/9UT8A1lnps7lEITm7NNsrfspWdZSbB6hZs_8BdUKVWfarmjSNWqAdNa6hCZE4GEc3YSLTd9FbZyvL_mGB3kt",
  category: "Education",
  contentRating: "Everyone",
  released: "Oct 17, 2023",
  downloads: "5,000+",
  downloadsShort: "5K+",
  installs: 9746,
  score: null,
  live: false,
};

function prettyCategory(raw: string | undefined): string {
  if (!raw) return FALLBACK.category;
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Fetch + parse the live Play Store listing. Never throws: on any failure it
 * returns the last-known-good FALLBACK with `live: false`.
 */
export async function getPlayStoreApp(): Promise<PlayStoreApp> {
  try {
    const res = await fetch(PLAY_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // Real-time-ish: re-fetch Play at most twice an hour.
      next: { revalidate: 1800 },
    });
    if (!res.ok) return FALLBACK;
    const html = await res.text();

    const app: PlayStoreApp = { ...FALLBACK, live: true };

    // --- Structured data (most reliable fields) ---
    const ld = html.match(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (ld) {
      try {
        const data = JSON.parse(ld[1]);
        if (data.name) app.name = String(data.name);
        if (data.image) app.icon = String(data.image);
        if (data.description) app.summary = String(data.description);
        if (data.contentRating) app.contentRating = String(data.contentRating);
        if (data.applicationCategory)
          app.category = prettyCategory(String(data.applicationCategory));
        if (data.author?.name) app.developer = String(data.author.name);
        // Star rating only if Play actually exposes an aggregate (avoids faking one).
        const rv = data.aggregateRating?.ratingValue;
        if (rv != null && !Number.isNaN(Number(rv))) app.score = Number(rv);
      } catch {
        /* keep fallbacks */
      }
    }

    // --- Install count: Play embeds ["5,000+", <min>, <exact>, "5K+"] ---
    const dl = html.match(/\["([\d,]+\+)",\s*\d+,\s*(\d+),\s*"([^"]+)"\]/);
    if (dl) {
      app.downloads = dl[1];
      app.installs = Number(dl[2]);
      app.downloadsShort = dl[3];
    }

    // --- Release date, best-effort ("Oct 17, 2023") ---
    const rel = html.match(/\["([A-Z][a-z]{2} \d{1,2}, \d{4})",\[\d{10}/);
    if (rel) app.released = rel[1];

    // Serve a crisp, sized icon from Google's CDN.
    if (app.icon && !/=/.test(app.icon)) app.icon = `${app.icon}=s512-rw`;

    return app;
  } catch {
    return FALLBACK;
  }
}
