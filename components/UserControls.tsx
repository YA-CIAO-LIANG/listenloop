"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  changeUser as changeUserAction,
  type UserChangeResult,
} from "@/app/admin/users/actions";
import type { AccountStatus, Role } from "@/lib/accounts";
import type { AccountPlan } from "@/lib/plans";
import { Button } from "./Button";

/**
 * Role and status for one account on the admin dashboard (D50, D56):
 * "Make admin" / "Make regular user", and "Disable" (asks once more) /
 * "Restore". Your own account can't be changed here.
 */
export function UserControls({
  user,
  self,
  changeUser = changeUserAction,
}: {
  user: { id: string; role: Role; status: AccountStatus; plan: AccountPlan };
  self: boolean;
  /** Injected in tests; the Server Action otherwise. */
  changeUser?: typeof changeUserAction;
}) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<UserChangeResult | null>(null);

  async function run(change: Parameters<typeof changeUserAction>[1]) {
    setPending(true);
    setConfirming(false);
    const outcome = await changeUser(user.id, change).catch(
      (): UserChangeResult => ({ ok: false, reason: "failed" }),
    );
    setPending(false);
    setResult(outcome);
    if (outcome.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <p>
        {t("roleIs", { role: t(`roles.${user.role}`) })} ·{" "}
        <span className={user.status === "disabled" ? "text-error" : ""}>
          {t(`statuses.${user.status}`)}
        </span>{" "}
        · {t("planIs", { plan: t(`plans.${user.plan}`) })}
      </p>
      {self ? (
        <p className="text-supporting text-ink-muted">{t("selfNote")}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run({ role: user.role === "admin" ? "user" : "admin" })
            }
          >
            {user.role === "admin" ? t("makeUser") : t("makeAdmin")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run({ plan: user.plan === "paid" ? "free" : "paid" })
            }
          >
            {user.plan === "paid" ? t("makeFree") : t("makePaid")}
          </Button>
          {user.status === "disabled" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run({ status: "active" })}
            >
              {t("restore")}
            </Button>
          ) : confirming ? (
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => run({ status: "disabled" })}
              >
                {t("confirmDisable")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                {t("cancel")}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              {t("disable")}
            </Button>
          )}
        </div>
      )}
      {confirming && (
        <p className="text-supporting text-ink-muted">{t("disableNote")}</p>
      )}
      <div aria-live="polite">
        {result &&
          (result.ok ? (
            <p className="text-supporting text-success">{t("saved")}</p>
          ) : (
            <p role="alert" className="text-supporting text-error">
              {t(`errors.${result.reason}`)}
            </p>
          ))}
      </div>
    </div>
  );
}
