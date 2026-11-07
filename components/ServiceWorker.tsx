"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (D64) in production builds only, so local
 * development never serves an old page from it. Failure is harmless: the
 * site works the same, just without the offline page.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
