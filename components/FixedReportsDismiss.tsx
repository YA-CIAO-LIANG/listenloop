"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dismissFixedReports } from "@/app/reports/sentence-actions";
import { Button } from "./Button";

/** "Got it" on the fixed-reports notice (D113). */
export function FixedReportsDismiss({ ids }: { ids: string[] }) {
  const t = useTranslations("sentenceReport");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await dismissFixedReports(ids).catch(() => null);
        router.refresh();
      }}
    >
      {t("fixedOk")}
    </Button>
  );
}
