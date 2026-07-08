"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let client: SupabaseClient | null = null;

/** Browser Supabase client (anon key, RLS enforced). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Magic links use the implicit (hash) flow; the login page parses the
        // `#access_token=…` fragment itself, so disable auto-detection to avoid
        // a race with that manual handling.
        detectSessionInUrl: false,
        flowType: "implicit",
      },
    });
  }
  return client;
}
