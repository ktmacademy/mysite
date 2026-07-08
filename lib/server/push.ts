// Server-side helper for invoking the `send-push` Supabase Edge Function.
// The function URL is derived from the Supabase project URL; the shared secret
// (PUSH_SECRET) must match the value stored in both the function's secrets and
// private.push_config in the database.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const pushSecret = process.env.PUSH_SECRET || "";

export interface PushArgs {
  /** Send to the `all` topic (every subscribed device). */
  broadcast?: boolean;
  /** Send to every device token belonging to these users. */
  userIds?: string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushOutcome {
  ok: boolean;
  error?: string;
  result?: unknown;
}

/** Fires a push. Never throws — returns an outcome so callers can decide
 *  whether a push failure should surface or stay best-effort. */
export async function sendPush(args: PushArgs): Promise<PushOutcome> {
  if (!supabaseUrl) return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL not set" };
  if (!pushSecret) return { ok: false, error: "PUSH_SECRET not configured" };
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-push-secret": pushSecret,
      },
      body: JSON.stringify(args),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = (result as { error?: string }).error || `HTTP ${res.status}`;
      return { ok: false, error, result };
    }
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
