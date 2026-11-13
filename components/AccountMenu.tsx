"use client";

import { applyLook, clearPersonalData } from "@/lib/personal-settings";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { withSignInResult } from "@/lib/auth/redirect";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { ButtonLink } from "./ButtonLink";

type AccountMenuProps = {
  /** The signed-in account, or null when signed out. */
  user: { email: string } | null;
};

/**
 * The header's account control: "Sign in" (Google) when signed out; when
 * signed in, an "Account" button that opens a small panel with the email,
 * "Sign out", and a link to the account page (disclosure pattern: Escape or a click outside closes it).
 */
export function AccountMenu({ user }: AccountMenuProps) {
  return user ? <AccountPanel email={user.email} /> : <SignInLink />;
}

function useCurrentPath(): string {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * "Sign in": to /login (D101), which offers Google, LINE, and email, and
 * comes back to this page. Uses useSearchParams: render it inside
 * Suspense.
 */
export function SignInLink({
  variant = "ghost",
  size = "sm",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const t = useTranslations("account");
  const here = useCurrentPath();
  return (
    <ButtonLink
      href={`/login?next=${encodeURIComponent(here)}`}
      variant={variant}
      size={size}
    >
      {t("signIn")}
    </ButtonLink>
  );
}

/**
 * Signs in with Google and comes back to this page. Also used where a
 * page asks to sign in (ProgressGate). Uses useSearchParams: render it
 * inside Suspense.
 */
export function SignInButton({
  variant = "ghost",
  size = "sm",
  label,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Instead of "Sign in" (e.g. "Continue with Google" on /login). */
  label?: string;
}) {
  const t = useTranslations("account");
  const router = useRouter();
  const here = useCurrentPath();
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = await loadBrowserSupabase();
    if (!supabase) {
      setPending(false);
      return;
    }
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", here);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setPending(false);
      router.replace(withSignInResult(here, "failed"), { scroll: false });
    }
  }

  return (
    <Button variant={variant} size={size} onClick={signIn} disabled={pending}>
      {pending ? t("signingIn") : (label ?? t("signIn"))}
    </Button>
  );
}

function AccountPanel({ email }: { email: string }) {
  const t = useTranslations("account");
  const router = useRouter();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setPending(true);
    const supabase = await loadBrowserSupabase();
    if (!supabase) {
      setPending(false);
      return;
    }
    setFailed(false);
    const { error } = await supabase.auth.signOut();
    setPending(false);
    if (error) {
      setFailed(true);
      return;
    }
    setOpen(false);
    // Nothing of this account stays on the device: its practice data and
    // its settings (wallpaper, accent, filters…) are in its cloud (D138).
    try {
      clearPersonalData(window.localStorage);
      applyLook(window.localStorage, document.documentElement);
    } catch {
      // Storage blocked: nothing was kept here.
    }
    // Home, rendered anew (the stores remount for the signed-out state).
    router.replace("/");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={toggleRef}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {t("account")}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </Button>
      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-20 mt-2 w-64 space-y-3 rounded-base border border-line surface-card p-4"
        >
          <p className="text-supporting text-ink-muted">
            {t("signedInAs")}
            {/* Never in analytics recordings (D148). */}
            <span
              data-clarity-mask="True"
              className="block text-body break-all text-ink"
            >
              {email}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={signOut}
              disabled={pending}
            >
              {pending ? t("signingOut") : t("signOut")}
            </Button>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {t("accountSettings")}
            </Link>
            {/* Each allowance and when it resets (D161). */}
            <Link
              href="/account/usage"
              onClick={() => setOpen(false)}
              className="text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {t("quota")}
            </Link>
          </div>
          {failed && (
            <p role="alert" className="text-supporting text-error">
              {t("signOutFailed")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
