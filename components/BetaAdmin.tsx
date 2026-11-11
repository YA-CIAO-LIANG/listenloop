"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  createInvite as createInviteAction,
  inviteFromWaitlist as inviteFromWaitlistAction,
  revokeInvite as revokeInviteAction,
  saveSignupSettings as saveSignupSettingsAction,
  type BetaAdminResult,
  type CreateInviteResult,
  type InviteWaitlistResult,
} from "@/app/admin/beta/actions";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";

/**
 * The admin's controls for sign-ups in stages (D132): the switch and cap,
 * new invites, withdrawing one, and inviting from the waiting list.
 */

const fieldClassName =
  "h-10 rounded-base border border-line bg-surface px-3 tabular-nums focus-visible:border-accent pointer-coarse:min-h-11";

function Message({
  result,
}: {
  result: { ok: boolean; reason?: string } | null;
}) {
  const t = useTranslations("admin.beta");
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="text-supporting text-success">
      {t("saved")}
    </p>
  ) : (
    <p role="alert" className="text-supporting text-error">
      {t(`errors.${result.reason as "failed"}`)}
    </p>
  );
}

/** Public sign-ups on or off, and the cap. */
export function SignupSettingsForm({
  open: savedOpen,
  cap: savedCap,
  save = saveSignupSettingsAction,
}: {
  open: boolean;
  cap: number;
  save?: typeof saveSignupSettingsAction;
}) {
  const t = useTranslations("admin.beta");
  const router = useRouter();
  const capId = useId();
  const [open, setOpen] = useState(savedOpen);
  const [cap, setCap] = useState(String(savedCap));
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BetaAdminResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const answer = await save({ open, cap: Number(cap) }).catch(
      (): BetaAdminResult => ({ ok: false, reason: "failed" }),
    );
    setResult(answer);
    setPending(false);
    if (answer.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SegmentedControl
        legend={t("openLegend")}
        value={open ? "open" : "closed"}
        options={[
          { value: "open", label: t("open") },
          { value: "closed", label: t("closed") },
        ]}
        onChange={(value) => setOpen(value === "open")}
        optionWidthClassName="min-w-16"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={capId} className="font-medium">
          {t("cap")}
        </label>
        <input
          id={capId}
          type="number"
          inputMode="numeric"
          min={0}
          max={1_000_000}
          step={1}
          value={cap}
          onChange={(event) => setCap(event.target.value)}
          className={`${fieldClassName} w-28`}
        />
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {t("save")}
        </Button>
      </div>
      <Message result={result} />
    </form>
  );
}

/** A link to copy, with a button that copies it. */
function CopyLink({ url, label }: { url: string; label: string }) {
  const t = useTranslations("admin.beta");
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <code className="text-supporting break-all">{url}</code>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("copyLabel", { label })}
        onClick={() =>
          void navigator.clipboard
            ?.writeText(url)
            .then(() => setCopied(true))
            .catch(() => {})
        }
      >
        {copied ? t("copied") : t("copy")}
      </Button>
    </span>
  );
}

/** A new invite: how many people, how many days, a note. */
export function InviteCreator({
  create = createInviteAction,
}: {
  create?: typeof createInviteAction;
}) {
  const t = useTranslations("admin.beta");
  const router = useRouter();
  const ids = { uses: useId(), days: useId(), note: useId() };
  const [uses, setUses] = useState("1");
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CreateInviteResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const answer = await create({
      maxUses: Number(uses),
      days: days.trim() === "" ? null : Number(days),
      note,
    }).catch((): CreateInviteResult => ({ ok: false, reason: "failed" }));
    setResult(answer);
    setPending(false);
    if (answer.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <label htmlFor={ids.uses} className="space-y-1">
          <span className="block text-supporting font-medium">{t("uses")}</span>
          <input
            id={ids.uses}
            type="number"
            min={1}
            max={10_000}
            value={uses}
            onChange={(event) => setUses(event.target.value)}
            className={`${fieldClassName} w-24`}
          />
        </label>
        <label htmlFor={ids.days} className="space-y-1">
          <span className="block text-supporting font-medium">{t("days")}</span>
          <input
            id={ids.days}
            type="number"
            min={1}
            max={365}
            value={days}
            placeholder={t("forever")}
            onChange={(event) => setDays(event.target.value)}
            className={`${fieldClassName} w-24`}
          />
        </label>
        <label htmlFor={ids.note} className="min-w-0 flex-1 basis-48 space-y-1">
          <span className="block text-supporting font-medium">{t("note")}</span>
          <input
            id={ids.note}
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={`${fieldClassName} w-full`}
          />
        </label>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {t("create")}
        </Button>
      </div>
      <p className="text-supporting text-ink-muted">{t("createHint")}</p>
      {result?.ok ? (
        <div role="status" className="space-y-1">
          <p className="text-supporting text-success">
            {t("created", { code: result.code })}
          </p>
          <CopyLink url={result.url} label={result.code} />
        </div>
      ) : (
        result && (
          <p role="alert" className="text-supporting text-error">
            {t(`errors.${result.reason}`)}
          </p>
        )
      )}
    </form>
  );
}

/** Withdraws an invite. */
export function RevokeInviteButton({
  id,
  code,
  revoke = revokeInviteAction,
}: {
  id: string;
  code: string;
  revoke?: typeof revokeInviteAction;
}) {
  const t = useTranslations("admin.beta");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={t("revokeLabel", { code })}
        onClick={async () => {
          setPending(true);
          const answer = await revoke(id).catch((): BetaAdminResult => ({
            ok: false,
            reason: "failed",
          }));
          setPending(false);
          setFailed(!answer.ok);
          if (answer.ok) router.refresh();
        }}
      >
        {t("revoke")}
      </Button>
      {failed && (
        <span role="alert" className="text-supporting text-error">
          {t("errors.failed")}
        </span>
      )}
    </span>
  );
}

export type WaitlistPerson = {
  id: string;
  email: string;
  purpose: string;
  joined: string;
  invited: string | null;
};

/** The waiting list: pick people, make each an invite link to send. */
export function WaitlistInviter({
  people,
  invite = inviteFromWaitlistAction,
}: {
  people: WaitlistPerson[];
  invite?: typeof inviteFromWaitlistAction;
}) {
  const t = useTranslations("admin.beta");
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<InviteWaitlistResult | null>(null);
  const waiting = people.filter((p) => !p.invited);

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run() {
    setPending(true);
    const answer = await invite([...chosen]).catch(
      (): InviteWaitlistResult => ({ ok: false, reason: "failed" }),
    );
    setResult(answer);
    setPending(false);
    if (answer.ok) {
      setChosen(new Set());
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setChosen(new Set(waiting.slice(0, 100).map((person) => person.id)))
          }
          disabled={waiting.length === 0}
        >
          {t("chooseAll", { count: Math.min(waiting.length, 100) })}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={run}
          disabled={pending || chosen.size === 0}
        >
          {t("inviteChosen", { count: chosen.size })}
        </Button>
      </div>
      {result?.ok && (
        <div
          role="status"
          className="space-y-2 rounded-base border border-line p-4"
        >
          <p className="text-supporting">
            {t("invitedIntro", { count: result.invites.length })}
          </p>
          <ul className="space-y-2">
            {result.invites.map((item) => (
              <li key={item.url} className="space-y-1">
                <p className="text-supporting font-medium">{item.email}</p>
                <CopyLink url={item.url} label={item.email} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-supporting text-error">
          {t(`errors.${result.reason}`)}
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {people.map((person) => (
          <li key={person.id} className="flex items-start gap-3 py-3">
            <input
              type="checkbox"
              aria-label={t("chooseLabel", { email: person.email })}
              checked={chosen.has(person.id)}
              disabled={!!person.invited}
              onChange={() => toggle(person.id)}
              className="mt-1 size-4 accent-accent pointer-coarse:size-5"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-medium break-all">{person.email}</p>
              {person.purpose && (
                <p className="text-supporting">{person.purpose}</p>
              )}
              <p className="text-metadata text-ink-muted">
                {person.invited
                  ? t("invitedOn", {
                      joined: person.joined,
                      invited: person.invited,
                    })
                  : t("joinedOn", { joined: person.joined })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
