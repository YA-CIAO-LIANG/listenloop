"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Saves the UI language. Setting a cookie in a Server Action makes Next.js
 * return the re-rendered page in the same round trip, so no refresh is needed.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
