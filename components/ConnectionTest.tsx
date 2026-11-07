"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  testConnections as testConnectionsAction,
  type ConnectionTestResult,
} from "@/app/admin/usage/actions";
import type { ConnectionCheck } from "@/lib/ai/types";
import { Button } from "./Button";

/** Hints for the answers that usually mean one setting (D49). */
const HINTS = new Set([
  "DeploymentNotFound",
  "400",
  "401",
  "403",
  "404",
  "429",
  "timeout",
  "network",
]);

/** The hint to show: the provider's code if known, else the status. */
function hintFor(check: ConnectionCheck): string {
  if (check.code && HINTS.has(check.code)) return check.code;
  const status = String(check.status ?? "");
  return HINTS.has(status) ? status : "other";
}

/**
 * "Test connection" on /admin/usage (D49): runs each provider's free
 * check and shows whether it worked, with the HTTP status, the provider's
 * error code, and a hint at which setting to look at.
 */
export function ConnectionTest({
  testConnections = testConnectionsAction,
}: {
  /** Injected in tests; the Server Action otherwise. */
  testConnections?: typeof testConnectionsAction;
}) {
  const t = useTranslations("adminUsage.connection");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    ConnectionTestResult | { ok: false; reason: "network" } | null
  >(null);

  async function run() {
    setPending(true);
    setResult(
      await testConnections().catch(
        () => ({ ok: false, reason: "network" }) as const,
      ),
    );
    setPending(false);
  }

  const row = (kind: "language" | "speech", check: ConnectionCheck | null) => {
    const detail = [check?.status && `HTTP ${check.status}`, check?.code]
      .filter(Boolean)
      .join(" ");
    return (
      <li key={kind} className="space-y-1 py-2">
        <p className="flex items-baseline justify-between gap-4">
          <span>{t(kind)}</span>
          <span
            className={`shrink-0 font-medium ${check?.ok ? "text-success" : "text-error"}`}
          >
            <span aria-hidden="true">{check?.ok ? "✓ " : "✗ "}</span>
            {!check
              ? t("noCheck")
              : check.ok
                ? t("ok")
                : detail
                  ? t("failedWith", { detail })
                  : t("failed")}
          </span>
        </p>
        {check && !check.ok && (
          <p className="text-ink-muted">
            {t(`hints.${hintFor(check)}` as "hints.other")}
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-supporting text-ink-muted">{t("intro")}</p>
      <Button variant="secondary" size="sm" onClick={run} disabled={pending}>
        {pending ? t("testing") : t("button")}
      </Button>
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <ul className="divide-y divide-line border-y border-line text-supporting">
              {row("language", result.language)}
              {row("speech", result.speech)}
            </ul>
          ) : (
            <p role="alert" className="text-supporting text-error">
              {t(`errors.${result.reason}`)}
            </p>
          ))}
      </div>
    </div>
  );
}
