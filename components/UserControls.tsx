"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  changeUser as changeUserAction,
  type UserChangeResult,
} from "@/app/admin/users/actions";
import type { AccountStatus, Role } from "@/lib/accounts";
import { ACCOUNT_PLANS, type AccountPlan } from "@/lib/plans";
import { Button } from "./Button";

/**
 * Role, plan, and status for one account on the admin dashboard (D50,
 * D56, D207): "Make admin" / "Make regular user", the plan (free, Plus,
 * Student, Pro), and "Disable" (asks once more) / "Restore". Your own
 * account can't be changed here.
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
  const planId = useId();

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
          {/* Any of the four plans (D207: the student plan has its own). */}
          <span className="flex items-center gap-2 text-supporting">
            <label htmlFor={planId} className="text-ink-muted">
              {t("planLabel")}
            </label>
            <select
              id={planId}
              value={user.plan}
              disabled={pending}
              onChange={(event) => {
                const plan = ACCOUNT_PLANS.find(
                  (p) => p === event.target.value,
                );
                if (plan && plan !== user.plan) void run({ plan });
              }}
              className="h-8 rounded-base border border-line bg-surface px-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11"
            >
              {ACCOUNT_PLANS.map((plan) => (
                <option key={plan} value={plan}>
                  {t(`plans.${plan}`)}
                </option>
              ))}
            </select>
          </span>
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
