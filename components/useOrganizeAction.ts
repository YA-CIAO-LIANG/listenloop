"use client";

import { useState } from "react";
import type { OrganizeResult } from "@/app/materials/organize-actions";

/** An organizing or moderating step's result; "reauth" is an admin's (D159). */
type ActionResult = OrganizeResult | { ok: false; reason: "reauth" };

export type OrganizeError = Exclude<ActionResult, { ok: true }>["reason"];

/**
 * Runs one organizing Server Action at a time: pending while it runs, and
 * the reason when it fails. The page re-renders with fresh data on
 * success (the actions revalidate /materials).
 */
export function useOrganizeAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<OrganizeError | null>(null);

  async function run(action: () => Promise<ActionResult>): Promise<boolean> {
    setPending(true);
    setError(null);
    const result = await action().catch((): ActionResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (!result.ok) setError(result.reason);
    return result.ok;
  }

  return { pending, error, run, clearError: () => setError(null) };
}
