"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { parseSignInResult, SIGN_IN_PARAM } from "@/lib/auth/redirect";
import { Button } from "./Button";

/**
 * Says why the learner is back without being signed in (?signin=failed or
 * cancelled, set by /auth/callback). Closing it drops the parameter.
 * Render inside <Suspense> (useSearchParams).
 */
export function SignInNotice() {
  const t = useTranslations("account");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const result = parseSignInResult(searchParams.get(SIGN_IN_PARAM));
  if (!result) return null;

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(SIGN_IN_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="border-b border-line bg-band print:hidden">
      <div
        role={result === "cancelled" ? "status" : "alert"}
        className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 split:px-6"
      >
        <p
          className={
            result !== "cancelled"
              ? "text-error"
              : "text-supporting text-ink-muted"
          }
        >
          {t(
            result === "failed"
              ? "signInFailed"
              : result === "disabled"
                ? "signInDisabled"
                : "signInCancelled",
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {t("dismiss")}
        </Button>
      </div>
    </div>
  );
}
