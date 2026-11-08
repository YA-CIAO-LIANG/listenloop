"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { setNewPassword, type EmailAuthResult } from "@/app/login/actions";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

/** The new password after a reset link (D101). */
export function NewPasswordForm({
  email,
  action = setNewPassword,
}: {
  email: string;
  action?: (form: FormData) => Promise<EmailAuthResult>;
}) {
  const t = useTranslations("login");
  const id = useId();
  const [result, submit, pending] = useActionState(
    async (_: EmailAuthResult | null, form: FormData) => action(form),
    null,
  );
  if (result?.ok) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-success">{t("resetDone")}</p>
        <ButtonLink href="/" variant="primary" arrow>
          {t("home")}
        </ButtonLink>
      </div>
    );
  }
  return (
    <form action={submit} className="space-y-4">
      <p className="text-ink-muted">{t("resetFor", { email })}</p>
      <div className="space-y-1">
        <label htmlFor={id} className="block font-medium">
          {t("newPassword")}
        </label>
        <input
          id={id}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
        <p className="text-supporting text-ink-muted">
          {t("passwordRule", { min: PASSWORD_MIN })}
        </p>
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? t("working") : t("resetSave")}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${result.reason}`)}
        </p>
      )}
    </form>
  );
}
