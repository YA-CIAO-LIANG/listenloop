"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  deleteReminder,
  reminderTime,
  saveReminder,
} from "@/app/account/reminder-actions";
import { DEFAULT_REMINDER_TIME, isReminderTime } from "@/lib/reminders";
import { Button } from "./Button";

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

/** The VAPID public key as the bytes pushManager.subscribe wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * Daily practice reminders (D111), per browser: asks for notification
 * permission only when the learner turns them on, subscribes to push,
 * and saves the time in their time zone. Off by default.
 */
export function ReminderSettings({ publicKey }: { publicKey: string }) {
  const t = useTranslations("reminders");
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [message, setMessage] = useState<"saved" | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported()) return setState({ kind: "unsupported" });
      if (Notification.permission === "denied") {
        return setState({ kind: "blocked" });
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const saved = subscription
        ? await reminderTime(subscription.endpoint).catch(() => null)
        : null;
      if (cancelled) return;
      if (subscription && saved) {
        setTime(saved);
        setState({ kind: "on", endpoint: subscription.endpoint });
      } else {
        setState({ kind: "off" });
      }
    })().catch(() => {
      if (!cancelled) setState({ kind: "unsupported" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({ kind: permission === "denied" ? "blocked" : "off" });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const result = await saveReminder({
        subscription: subscription.toJSON(),
        time,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale,
      });
      if (!result.ok) throw new Error("save");
      setState({ kind: "on", endpoint: subscription.endpoint });
      setMessage("saved");
    } catch {
      setMessage("failed");
    }
  }

  async function turnOff() {
    if (state.kind !== "on") return;
    setMessage(null);
    const registration = await navigator.serviceWorker.getRegistration();
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
    await deleteReminder(state.endpoint).catch(() => null);
    setState({ kind: "off" });
  }

  return (
    <section
      aria-labelledby="reminders"
      className="mt-16 max-w-reading border-t border-line pt-8"
    >
      <h2 id="reminders" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="mt-4 text-ink-muted">{t("intro")}</p>
      {state.kind === "unsupported" && (
        <p className="mt-4 text-supporting text-ink-muted">
          {t("unsupported")}
        </p>
      )}
      {state.kind === "blocked" && (
        <p className="mt-4 text-supporting text-error">{t("blocked")}</p>
      )}
      {(state.kind === "off" || state.kind === "on") && (
        <div className="mt-6 space-y-4">
          <p className="text-supporting">
            {state.kind === "on" ? t("on", { time }) : t("off")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="reminder-time" className="block font-medium">
                {t("timeLabel")}
              </label>
              <input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(event) =>
                  isReminderTime(event.target.value) &&
                  setTime(event.target.value)
                }
                className="mt-2 block rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
              />
            </div>
            <Button variant="primary" onClick={save}>
              {state.kind === "on" ? t("saveTime") : t("turnOn")}
            </Button>
            {state.kind === "on" && (
              <Button variant="secondary" onClick={turnOff}>
                {t("turnOff")}
              </Button>
            )}
          </div>
          {message && (
            <p
              role="status"
              className={`text-supporting ${message === "failed" ? "text-error" : "text-success"}`}
            >
              {t(message)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
