"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  refundPayment as refundAction,
  simulateSubscription as simulateAction,
  type RevenueActionResult,
} from "@/app/admin/revenue/actions";
import { Button } from "./Button";

const failed = (): RevenueActionResult => ({ ok: false, reason: "failed" });

/**
 * A full refund (D85), in two steps so it isn't clicked by accident:
 * "Refund…", then "Refund NT$149" to confirm.
 */
export function RefundButton({
  paymentId,
  amount,
  refund = refundAction,
}: {
  paymentId: string;
  /** Formatted, for the confirm button. */
  amount: string;
  refund?: (id: string) => Promise<RevenueActionResult>;
}) {
  const t = useTranslations("admin.revenue");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function confirm() {
    setPending(true);
    setError(false);
    const result = await refund(paymentId).catch(failed);
    setPending(false);
    setConfirming(false);
    if (result.ok) router.refresh();
    else setError(true);
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex flex-wrap items-center gap-2"
    >
      {confirming ? (
        <>
          <Button
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={confirm}
          >
            {t("refundConfirm", { amount })}
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            {t("cancel")}
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => setConfirming(true)}>
          {t("refund")}
        </Button>
      )}
      {error && (
        <span role="alert" className="text-supporting text-error">
          {t("failed")}
        </span>
      )}
    </span>
  );
}

/** The fake provider's "what happens later" buttons (D85), for testing. */
export function SimulateButtons({
  userId,
  simulate = simulateAction,
}: {
  userId: string;
  simulate?: (
    userId: string,
    change: "renew" | "past_due" | "expire",
  ) => Promise<RevenueActionResult>;
}) {
  const t = useTranslations("admin.revenue.simulate");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function run(change: "renew" | "past_due" | "expire") {
    setPending(true);
    setError(false);
    const result = await simulate(userId, change).catch(failed);
    setPending(false);
    if (result.ok) router.refresh();
    else setError(true);
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex flex-wrap items-center gap-2"
    >
      {(["renew", "past_due", "expire"] as const).map((change) => (
        <Button
          key={change}
          size="sm"
          disabled={pending}
          onClick={() => run(change)}
        >
          {t(change)}
        </Button>
      ))}
      {error && (
        <span role="alert" className="text-supporting text-error">
          {t("failed")}
        </span>
      )}
    </span>
  );
}
