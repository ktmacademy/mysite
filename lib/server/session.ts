import crypto from "crypto";

/**
 * Tiny, dependency-free signed session cookie for the admin panel. The panel
 * runs its own username/password login (see /api/admin/login), so it doesn't
 * use Supabase Auth. On success we issue this HMAC-signed, httpOnly cookie; a
 * valid, unexpired signature is proof the holder passed login.
 */

export const ADMIN_COOKIE = "admin_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  username: string;
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

function cookieAttrs(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** A `Set-Cookie` value that starts a session for [username]. */
export function createSessionCookie(username: string): string {
  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const value = `${body}.${sign(body)}`;
  return `${ADMIN_COOKIE}=${value}; ${cookieAttrs(MAX_AGE_SEC)}`;
}

/** A `Set-Cookie` value that immediately clears the session. */
export function clearSessionCookie(): string {
  return `${ADMIN_COOKIE}=; ${cookieAttrs(0)}`;
}

/** Verify the session cookie on a request; returns the payload or null. */
export function readSession(request: Request): SessionPayload | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${ADMIN_COOKIE}=([^;]+)`));
  if (!match) return null;

  const value = match[1];
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  // Constant-time signature check.
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString()
    ) as SessionPayload;
    if (!payload.username || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
