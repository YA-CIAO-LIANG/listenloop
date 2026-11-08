"use client";

import { useSyncExternalStore } from "react";
import { toLocalDate, type LocalDate } from "@/lib/dates";

const noop = () => () => {};
const today = () => toLocalDate(new Date());

/**
 * Today in the viewer's time zone, or null while rendering on the server
 * (and the first client render): the server's date can differ from the
 * viewer's (Vercel runs in UTC; Taiwan is 8 hours ahead), which showed the
 * wrong day and broke hydration (D91).
 */
export function useToday(): LocalDate | null {
  return useSyncExternalStore(noop, today, () => null);
}
