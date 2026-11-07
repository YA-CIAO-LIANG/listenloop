"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { setFeedbackStatus as setFeedbackStatusAction } from "@/app/admin/feedback/actions";
import { Button } from "./Button";

/** "Mark done" / "Reopen" for one piece of feedback (D60). */
export function FeedbackStatusButton({
  id,
  status,
  setFeedbackStatus = setFeedbackStatusAction,
}: {
  id: string;
  status: "open" | "done";
  /** Injected in tests; the Server Action otherwise. */
  setFeedbackStatus?: typeof setFeedbackStatusAction;
}) {
  const t = useTranslations("admin.feedback");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex items-center gap-3">
      <Button
        variant={status === "open" ? "secondary" : "ghost"}
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await setFeedbackStatus(
            id,
            status === "open" ? "done" : "open",
          ).catch(() => ({ ok: false as const }));
          setPending(false);
          setFailed(!result.ok);
          if (result.ok) router.refresh();
        }}
      >
        {status === "open" ? t("markDone") : t("reopen")}
      </Button>
      {failed && (
        <span role="alert" className="text-supporting text-error">
          {t("failed")}
        </span>
      )}
    </span>
  );
}
