"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";
import {
  TURNSTILE_FIELD,
  TURNSTILE_SCRIPT,
  turnstileSiteKey,
} from "@/lib/turnstile";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => string | undefined;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi | null> | null = null;

/** Loads Cloudflare's script once (allowed by the CSP's strict-dynamic). */
function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile's check (D160), in a form: usually invisible to
 * people, a short challenge when something looks automated. Renders
 * nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. The token goes
 * into a hidden field (for forms posted as FormData) and to `onToken`.
 */
export function Turnstile({
  onToken,
  action,
}: {
  onToken?: (token: string) => void;
  /** Shown in Cloudflare's analytics: which form it was. */
  action: string;
}) {
  const siteKey = turnstileSiteKey();
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let id: string | undefined;
    let cancelled = false;
    const set = (token: string) => {
      if (field.current) field.current.value = token;
      callback.current?.(token);
    };
    void loadTurnstile().then((api) => {
      if (!api || cancelled || !box.current) return;
      id = api.render(box.current, {
        sitekey: siteKey,
        action,
        language: locale === "en" ? "en" : "zh-tw",
        theme: "auto",
        size: "flexible",
        callback: set,
        "expired-callback": () => set(""),
        "error-callback": () => set(""),
      });
    });
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, action, locale]);

  if (!siteKey) return null;
  return (
    <div>
      <div ref={box} />
      <input ref={field} type="hidden" name={TURNSTILE_FIELD} />
    </div>
  );
}
