"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  parseLibraryParams,
  writeLibraryParams,
  type LibraryFilter,
} from "@/lib/library";

/**
 * The library's filter, kept in the URL (D70) so a reload or a shared
 * link keeps it. Changes replace the URL without scrolling or adding
 * history. Use inside <Suspense> (useSearchParams).
 */
export function useLibraryFilter(): [
  LibraryFilter,
  (next: LibraryFilter) => void,
] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseLibraryParams(searchParams);

  const setFilter = useCallback(
    (next: LibraryFilter) => {
      const query = writeLibraryParams(
        new URLSearchParams(searchParams.toString()),
        next,
      ).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  return [filter, setFilter];
}

/** Adds `value` if it's off, removes it if it's on, keeping `order`. */
export function toggled<T>(
  list: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : order.filter((v) => v === value || list.includes(v));
}
