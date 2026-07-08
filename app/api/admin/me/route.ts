import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

/**
 * Lightweight gate the client uses to confirm the signed-in user is an admin,
 * reusing the same `requireAdmin` rule as every other admin API. Returns 200
 * with the email for admins, 401/403 otherwise.
 */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  return NextResponse.json({ ok: true, username: check.username });
}
