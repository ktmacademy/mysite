"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { verifyAdmin } from "./admin-api";

/**
 * Redirects to the login page when there is no valid admin session cookie.
 * Returns true once the session has been confirmed.
 */
export function useAdminGuard(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    verifyAdmin().then((ok) => {
      if (cancelled) return;
      if (ok) setReady(true);
      else router.replace("/admin");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return ready;
}
