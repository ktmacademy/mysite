import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/session";

/** Clears the admin session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
