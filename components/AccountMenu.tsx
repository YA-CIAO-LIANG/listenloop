"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { withSignInResult } from "@/lib/auth/redirect";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "./Button";

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
  return user ? <AccountPanel email={user.email} /> : <SignInButton />;
}

function useCurrentPath(): string {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return query ? `${pathname}?${query}` : pathname;
}

function SignInButton() {
  const t = useTranslations("account");
  const router = useRouter();
  const here = useCurrentPath();
  const [pending, setPending] = useState(false);

  async function signIn() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setPending(true);
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
    <Button variant="ghost" size="sm" onClick={signIn} disabled={pending}>
      {pending ? t("signingIn") : t("signIn")}
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
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setPending(true);
    setFailed(false);
    const { error } = await supabase.auth.signOut();
    setPending(false);
    if (error) {
      setFailed(true);
      return;
    }
    setOpen(false);
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
          className="absolute top-full right-0 z-20 mt-2 w-64 space-y-3 rounded-base border border-line bg-surface p-4"
        >
          <p className="text-supporting text-ink-muted">
            {t("signedInAs")}
            <span className="block text-body break-all text-ink">{email}</span>
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
