"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { UsageBlock } from "@/lib/usage";
import { usePlan } from "./PlanProvider";

/**
 * Why an AI step stopped at a limit (D77): which allowance (today's,
 * the batch jobs', the site's month, or speech) and when it comes back,
 * in Taiwan time. Admins also get a link to the usage page. Without the
 * details (an older server), `fallback` is shown as before.
 */
export function UsageLimitMessage({
  block,
  fallback,
}: {
  block?: UsageBlock | null;
  fallback: string;
}) {
  const t = useTranslations("usageLimit");
  const format = useFormatter();
  const admin = usePlan() === "admin";
  if (!block) return <>{fallback}</>;
  const when = format.dateTime(new Date(block.resetsAt), {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (
    <>
      {t(block.kind, { when })}
      {admin && (
        <>
          {" "}
          <Link
            href="/admin/usage"
            className="text-accent-ink underline underline-offset-4"
          >
            {t("adminLink")}
          </Link>
        </>
      )}
    </>
  );
}
