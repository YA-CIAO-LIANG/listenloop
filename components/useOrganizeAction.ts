"use client";

import { useState } from "react";
import type { OrganizeResult } from "@/app/create/organize-actions";

export type OrganizeError = Exclude<OrganizeResult, { ok: true }>["reason"];

/**
 * Runs one organizing Server Action at a time: pending while it runs, and
 * the reason when it fails. The page re-renders with fresh data on
 * success (the actions revalidate /create).
 */
export function useOrganizeAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<OrganizeError | null>(null);

  async function run(action: () => Promise<OrganizeResult>): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await action().catch((): OrganizeResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (!result.ok) setError(result.reason);
    return result.ok;
  }

  return { pending, error, run, clearError: () => setError(null) };
}
