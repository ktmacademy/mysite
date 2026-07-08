import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readSession } from "./session";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Service-role client. Server-side only — bypasses RLS. */
export function serviceClient(): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * True when a PostgREST error means the table isn't there yet (migration not
 * applied). Lets pages degrade to a "run the migration" empty state instead
 * of erroring.
 */
export function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" || // undefined_table
    error.code === "PGRST205" || // PostgREST: table not found in schema cache
    /does not exist|could not find the table/i.test(error.message || "")
  );
}

/**
 * Exact row count for a table, or null if the table is missing.
 * `filter` is applied as chained `.eq()` pairs.
 *
 * Uses a non-HEAD request (limit 1) because supabase-js does not populate the
 * error object for HEAD requests against a missing table — it would silently
 * report 0 instead of "absent". The exact count still comes from the
 * Content-Range header regardless of the row limit.
 */
export async function safeCount(
  supabase: SupabaseClient,
  table: string,
  filter?: Record<string, string | number | boolean>
): Promise<number | null> {
  let query = supabase.from(table).select("*", { count: "exact" }).limit(1);
  for (const [k, v] of Object.entries(filter || {})) query = query.eq(k, v);
  const { count, error } = await query;
  if (error) return tableMissing(error) ? null : 0;
  return count ?? 0;
}

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
  full_name: string | null;
  avatar_url: string | null;
}

function mapAuthUser(u: any): AuthUser {
  return {
    id: u.id,
    email: u.email || "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    provider: (u.app_metadata?.provider || u.app_metadata?.providers?.[0] || "email") as string,
    full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
    avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
  };
}

/** Fetches a single auth user by id via the GoTrue admin endpoint. */
export async function getAuthUser(id: string): Promise<AuthUser | null> {
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  if (!u || !u.id) return null;
  return mapAuthUser(u);
}

/**
 * Lists Supabase auth users via the GoTrue admin endpoint (raw fetch so we can
 * read the x-total-count header, which supabase-js does not expose).
 */
export async function listAuthUsers({
  page = 1,
  perPage = 1000,
}: { page?: number; perPage?: number } = {}): Promise<{ users: AuthUser[]; total: number }> {
  const res = await fetch(
    `${url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const total = Number(res.headers.get("x-total-count") || "0");
  const json = await res.json().catch(() => ({ users: [] }));
  const raw = (json.users || []) as any[];
  const users: AuthUser[] = raw.map(mapAuthUser);
  return { users, total: total || users.length };
}

export type AdminCheck =
  | { ok: true; username: string; supabase: SupabaseClient }
  | { ok: false; error: string; status: number };

/**
 * Authorizes an /api/admin/* request via the signed admin session cookie set at
 * login (see /api/admin/login). A valid, unexpired signature is proof the
 * caller passed username/password login, so we hand back a service-role client
 * for the route to use. This is the single authorization chokepoint for every
 * admin API (and the client's /api/admin/me gate).
 */
export async function requireAdmin(request: Request): Promise<AdminCheck> {
  const session = readSession(request);
  if (!session) {
    return { ok: false, error: "Not signed in", status: 401 };
  }
  return { ok: true, username: session.username, supabase: serviceClient() };
}
