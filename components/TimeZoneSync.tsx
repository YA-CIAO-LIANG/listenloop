"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { saveTimeZone } from "@/app/time-zone-actions";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

const YEAR = 365 * 24 * 3600;

/**
 * The device's time zone, told to the server (D139): kept in a cookie for
 * the dates the server writes into pages, and (signed in) in the profile.
 * When it changed, the page is rendered again so those dates match.
 */
export function TimeZoneSync({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;
    const saved = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);
    if (saved && decodeURIComponent(saved) === zone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${YEAR}; samesite=lax`;
    if (signedIn) void saveTimeZone(zone).catch(() => {});
    // Only when it really changed: the first visit stays as it is.
    if (saved) router.refresh();
  }, [router, signedIn]);
  return null;
}
