"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import {
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  type EmailAuthResult,
} from "@/app/login/actions";
import { PASSWORD_MIN, passwordStrength } from "@/lib/auth/password";
import { Button } from "./Button";
import { SignInButton } from "./AccountMenu";
import { Turnstile } from "./Turnstile";

type Mode = "signin" | "signup" | "forgot";
type Action = (form: FormData) => Promise<EmailAuthResult>;

const fieldClassName =
  "block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";

/**
 * Every way to sign in (D101): Google, LINE (when set up), and email with
 * a password — signing in, making an account (the address is confirmed by
 * email), and resetting a forgotten password.
 */
export function LoginForm({
  next,
  line,
  actions = {
    signin: signInWithEmail,
    signup: signUpWithEmail,
    forgot: requestPasswordReset,
  },
}: {
  next: string;
  /** LINE Login is set up (LINE_CHANNEL_ID / SECRET). */
  line: boolean;
  /** Injected in tests; the Server Actions otherwise. */
  actions?: Record<Mode, Action>;
}) {
  const t = useTranslations("login");
  const ids = { email: useId(), password: useId(), strength: useId() };
  const [mode, setMode] = useState<Mode>("signin");
  const [password, setPassword] = useState("");
  const [result, submit, pending] = useActionState(
    async (_: EmailAuthResult | null, form: FormData) => actions[mode](form),
    null,
  );
  const strength = password ? passwordStrength(password) : null;

  return (
    <div className="max-w-md space-y-8">
      <div className="space-y-3">
        <SignInButton variant="secondary" size="md" label={t("google")} />
        {line && (
          <a
            href={`/auth/line?next=${encodeURIComponent(next)}`}
            className="pressable inline-flex min-h-10 w-full items-center justify-center rounded-base border border-line bg-ink/4 px-4 py-1.5 text-ink hover:bg-ink/8 pointer-coarse:min-h-11"
          >
            {t("line")}
          </a>
        )}
      </div>

      <div className="flex items-center gap-3 text-supporting text-ink-muted">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        {t("or")}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <form action={submit} className="space-y-4" key={mode}>
        <h2 className="font-display text-h3">{t(`titles.${mode}`)}</h2>
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1">
          <label htmlFor={ids.email} className="block font-medium">
            {t("email")}
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            className={fieldClassName}
          />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-1">
            <label htmlFor={ids.password} className="block font-medium">
              {t("password")}
            </label>
            <input
              id={ids.password}
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "signup" ? PASSWORD_MIN : undefined}
              aria-describedby={mode === "signup" ? ids.strength : undefined}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClassName}
            />
            {mode === "signup" && (
              <p id={ids.strength} className="text-supporting text-ink-muted">
                {t("passwordRule", { min: PASSWORD_MIN })}
                {strength && (
                  <>
                    {" "}
                    <span
                      className={
                        strength === "weak" ? "text-error" : "text-success"
                      }
                    >
                      {t(`strength.${strength}`)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}
        {/* The bot check on sign-up (D160); off without its keys. */}
        {mode === "signup" && <Turnstile action="signup" />}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t("working") : t(`submit.${mode}`)}
        </Button>
        <p role="status" className="text-supporting">
          {result?.ok && result.sent && mode !== "signin" ? (
            <span className="text-success">{t(`sent.${mode}`)}</span>
          ) : result && !result.ok ? (
            <span className="text-error">
              {t(`errors.${result.reason}`)}
              {result.reason === "full" && (
                <>
                  {" "}
                  <Link
                    href="/beta?reason=full"
                    className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
                  >
                    {t("joinWaitlist")}
                  </Link>
                </>
              )}
            </span>
          ) : null}
        </p>
      </form>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-supporting">
        {(["signin", "signup", "forgot"] as const)
          .filter((m) => m !== mode)
          .map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setPassword("");
              }}
              className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {t(`switch.${m}`)}
            </button>
          ))}
      </div>
    </div>
  );
}
