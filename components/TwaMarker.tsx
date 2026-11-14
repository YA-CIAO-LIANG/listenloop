"use client";

import { useEffect } from "react";
import { isTwaReferrer } from "@/lib/twa";

const KEY = "ll-twa";

/**
 * Marks the page when it runs inside the Android app (Trusted Web
 * Activity, D178): `<html data-twa>`. Only the first page Android opens
 * has the app as its referrer, so the tab remembers it for the session.
 * Nothing differs yet; it is where in-app-only rules hook in, e.g.
 * Google Play's billing policy once paid plans open (docs/twa.md).
 */
export function TwaMarker() {
  useEffect(() => {
    let inApp = isTwaReferrer(document.referrer);
    try {
      if (inApp) sessionStorage.setItem(KEY, "1");
      else inApp = sessionStorage.getItem(KEY) === "1";
    } catch {
      // Storage blocked: only the first page is marked.
    }
    if (inApp) document.documentElement.dataset.twa = "";
  }, []);
  return null;
}
