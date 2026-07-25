/**
 * Human-readable labels for rows of `analytics_events`.
 *
 * The app logs a bare event name plus a small `properties` bag (see
 * `AnalyticsService` in the Flutter app). Rendering only the event name makes
 * the activity feed useless — every `screen_view` looks identical — so map the
 * name to a label and pull the one property that actually identifies the row.
 */

/** Router paths emitted by `screen_view` → the screen a user would recognise. */
const SCREEN_LABELS: Record<string, string> = {
  "/": "Home",
  "/login": "Login",
  "/splash": "Splash",
  "/onboarding": "Onboarding",
  "/dashboard": "Dashboard",
  "/downloads": "Downloads",
  "/ai-chat": "AI Chat",
  "/ai/ask": "AI Ask",
  "/chat": "Chat",
  "/courses": "Courses",
  "/settings": "Settings",
  "/syllabus": "Syllabus",
  "/notes": "Notes",
  "/entrance": "Entrance",
  "/loksewa": "Loksewa",
  "/youtube": "YouTube",
  "/extra": "Extra",
  "/notifications": "Notifications",
  "/noticesandresults": "Notices & Results",
  "/scrollableMotivation": "Motivation",
  "/bookmarks": "Bookmarks",
  "/quiz": "Quiz",
  "/study-timer": "Study Timer",
  // Screens opened with Navigator.push (see `analyticsRoute` in the app).
  "/pdf-viewer": "PDF Viewer",
  "/page": "Content Page",
  "/ai-chat/settings": "AI Chat Settings",
  "/chat/image-upload": "Chat Image Upload",
  "/courses/folder": "Course Folder",
  "/courses/playlist": "Course Playlist",
  "/courses/video": "Course Video",
  "/courses/youtube-sign-in": "YouTube Sign-in",
  "/downloads/pdf": "Downloaded PDF",
  "/loksewa/web": "Loksewa Link",
  "/notes/course-wizard": "Notes Course Picker",
  "/notes/document": "Note Document",
  "/noticesandresults/pdf": "Notice PDF",
  "/noticesandresults/variant": "Notice Province",
  "/quiz/play": "Quiz",
  "/quiz/result": "Quiz Result",
  "/settings/contact-us": "Contact Us",
  "/settings/feedback": "Feedback",
  "/settings/privacy-policy": "Privacy Policy",
  "/settings/about-us": "About Us",
  "/syllabus/pdf": "Syllabus PDF",
  "/syllabus/program-pdf": "Program Syllabus PDF",
};

const EVENT_LABELS: Record<string, string> = {
  app_open: "App opened",
  login: "Logged in",
  sign_up: "Signed up",
  sign_out: "Signed out",
  screen_view: "Viewed",
  onboarding_start: "Onboarding started",
  onboarding_step: "Onboarding step",
  onboarding_complete: "Onboarding complete",
  whatsapp_optin: "WhatsApp opt-in",
  share: "Shared",
  download: "Downloaded",
  quiz_complete: "Quiz completed",
};

export function screenLabel(screen: string): string {
  // Strip query strings so `/notes?id=3` still resolves to a known screen.
  const path = screen.split("?")[0];
  if (SCREEN_LABELS[path]) return SCREEN_LABELS[path];
  const known = Object.keys(SCREEN_LABELS)
    .filter((p) => p !== "/" && path.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return known ? `${SCREEN_LABELS[known]} · ${path.slice(known.length + 1)}` : path;
}

export function eventLabel(eventName: string): string {
  return EVENT_LABELS[eventName] ?? eventName.replace(/_/g, " ");
}

/** The detail that distinguishes one row of an event from another, if any. */
export function eventDetail(
  eventName: string,
  properties: Record<string, any> | null | undefined,
): string | null {
  const p = properties ?? {};
  switch (eventName) {
    case "screen_view":
      return typeof p.screen === "string" ? screenLabel(p.screen) : null;
    case "login":
    case "sign_up":
      return p.method ?? null;
    case "onboarding_step":
      return p.step ?? null;
    case "share":
      return p.surface ?? null;
    case "quiz_complete":
      return [p.quiz_id, p.score != null ? `score ${p.score}` : null]
        .filter(Boolean)
        .join(" · ") || null;
    default:
      return p.title ?? p.name ?? null;
  }
}

/** One-line summary of an event row, e.g. `Viewed · Notices & Results`. */
export function describeEvent(
  eventName: string,
  properties: Record<string, any> | null | undefined,
): string {
  const detail = eventDetail(eventName, properties);
  const label = eventLabel(eventName);
  return detail ? `${label} · ${detail}` : label;
}
