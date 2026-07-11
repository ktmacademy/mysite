/**
 * Client helper for ad-control writes. These go through /api/admin/ads (which
 * verifies the admin session cookie and writes with the service-role key)
 * instead of writing to Supabase directly from the browser — the ad tables'
 * RLS blocks anon writes. Returns an error string on failure, or null on success.
 */
export async function adminAdsWrite(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.error || `Request failed (${res.status})`;
  } catch (e) {
    return e instanceof Error ? e.message : "Network error";
  }
}
