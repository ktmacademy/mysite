"use client";

/**
 * Client helpers for the /api/admin/* routes. Auth is the httpOnly admin
 * session cookie set at login, which the browser sends automatically on
 * same-origin requests — so these calls carry no token themselves.
 */

/** POST JSON to an /api/admin/* route. Throws with the server's error message. */
export async function adminFetch<T = any>(
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json as T;
}

/** GET an /api/admin/* route. */
export async function adminGet<T = any>(path: string): Promise<T> {
  const res = await fetch(path);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json as T;
}

/** Log in with username + password; sets the session cookie on success. */
export async function adminLogin(
  username: string,
  password: string
): Promise<void> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Login failed (${res.status})`);
  }
}

/** Clear the session cookie. */
export async function adminLogout(): Promise<void> {
  await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
}

/**
 * Whether the current session is a valid admin (per /api/admin/me). Used by the
 * login and dashboard gates.
 */
export async function verifyAdmin(): Promise<boolean> {
  try {
    await adminGet("/api/admin/me");
    return true;
  } catch {
    return false;
  }
}
