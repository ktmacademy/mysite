import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/admin";
import { createSessionCookie } from "@/lib/server/session";

/**
 * Username/password login. Verifies the credentials against the bcrypt hash in
 * `public.admin_accounts` (via the verify_admin_login DB function, run with the
 * service role) and, on success, sets the signed admin session cookie.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  const { data, error } = await serviceClient().rpc("verify_admin_login", {
    p_username: username,
    p_password: password,
  });

  if (error) {
    // Most likely the admin_accounts migration hasn't been applied yet.
    return NextResponse.json(
      { error: "Login is not set up yet. Apply the admin_accounts migration." },
      { status: 500 }
    );
  }
  if (data !== true) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true, username });
  res.headers.set("Set-Cookie", createSessionCookie(username));
  return res;
}
