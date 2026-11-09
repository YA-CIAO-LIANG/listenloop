"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  resolveContentFix,
  type FixDecision,
  type FixResult,
} from "@/app/admin/fixes/actions";
import { Button } from "./Button";

/**
 * Accept or reject one suggested fix (D117). Accepting writes it into the
 * material; if the sentence changed since, the fix is set aside instead.
 */
export function ContentFixActions({
  id,
  resolve = resolveContentFix,
}: {
  id: string;
  resolve?: typeof resolveContentFix;
}) {
  const t = useTranslations("admin.fixes");
  const [state, setState] = useState<
    "idle" | "pending" | "accepted" | "rejected" | "stale" | "failed"
  >("idle");

  async function decide(decision: FixDecision) {
    setState("pending");
    const result: FixResult = await resolve(id, decision).catch(() => ({
      ok: false as const,
      reason: "failed" as const,
    }));
    if (result.ok) setState(decision === "accept" ? "accepted" : "rejected");
    else setState(result.reason === "stale" ? "stale" : "failed");
  }

  if (state === "accepted" || state === "rejected" || state === "stale") {
    return (
      <p role="status" className="text-supporting text-ink-muted">
        {t(`done.${state}`)}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={state === "pending"}
          onClick={() => decide("accept")}
        >
          {t("accept")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={state === "pending"}
          onClick={() => decide("reject")}
        >
          {t("reject")}
        </Button>
      </div>
      {state === "failed" && (
        <p role="alert" className="text-supporting text-error">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
