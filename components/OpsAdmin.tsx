"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  endSiteAnnouncement as endAction,
  postSiteAnnouncement as postAction,
  saveSiteSwitches as saveAction,
  type OpsResult,
} from "@/app/admin/ops/actions";
import {
  ANNOUNCEMENT_LEVELS,
  SITE_ANNOUNCEMENT_MAX,
  SWITCHABLE_FEATURES,
  type AnnouncementLevel,
  type SiteSwitches,
} from "@/lib/site-switches";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";
import { fieldClassName } from "./CreatePracticeForm";

/** The admin's emergency switches and announcements (D155). */

function Message({ result }: { result: OpsResult | null }) {
  const t = useTranslations("admin.ops");
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="text-supporting text-success">
      {t("saved")}
    </p>
  ) : (
    <p role="alert" className="text-supporting text-error">
      {t(`errors.${result.reason}`)}
    </p>
  );
}

function OnOff({
  legend,
  on,
  onChange,
  mode = false,
}: {
  legend: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** A mode (maintenance, read-only) is on or off; a feature, on or paused. */
  mode?: boolean;
}) {
  const t = useTranslations("admin.ops");
  return (
    <SegmentedControl
      legend={legend}
      value={on ? "on" : "off"}
      options={[
        { value: "on", label: t("on") },
        { value: "off", label: mode ? t("closed") : t("off") },
      ]}
      onChange={(value) => onChange(value === "on")}
      optionWidthClassName="min-w-12"
    />
  );
}

export function SiteSwitchesForm({
  saved,
  save = saveAction,
}: {
  saved: SiteSwitches;
  save?: typeof saveAction;
}) {
  const t = useTranslations("admin.ops");
  const router = useRouter();
  const [switches, setSwitches] = useState(saved);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<OpsResult | null>(null);

  async function commit() {
    setConfirming(false);
    setPending(true);
    const answer = await save(switches).catch((): OpsResult => ({
      ok: false,
      reason: "failed",
    }));
    setResult(answer);
    setPending(false);
    if (answer.ok) router.refresh();
  }

  // "On" here means the site works normally: maintenance and read-only
  // are shown as their own switches, on when active.
  const row = (
    label: string,
    hint: string | null,
    control: React.ReactNode,
  ) => (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-3">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-supporting text-ink-muted">{hint}</p>}
      </div>
      {control}
    </div>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setConfirming(true);
      }}
      className="space-y-4"
    >
      <div>
        {row(
          t("maintenance"),
          t("maintenanceHint"),
          <OnOff
            mode
            legend={t("maintenance")}
            on={switches.maintenance}
            onChange={(maintenance) =>
              setSwitches((s) => ({ ...s, maintenance }))
            }
          />,
        )}
        {row(
          t("readOnly"),
          t("readOnlyHint"),
          <OnOff
            mode
            legend={t("readOnly")}
            on={switches.readOnly}
            onChange={(readOnly) => setSwitches((s) => ({ ...s, readOnly }))}
          />,
        )}
      </div>
      <h3 className="pt-4 font-medium">{t("featuresTitle")}</h3>
      <div>
        {SWITCHABLE_FEATURES.map((feature) =>
          row(
            t(`features.${feature}`),
            null,
            <OnOff
              key={feature}
              legend={t(`features.${feature}`)}
              on={switches.features[feature]}
              onChange={(on) =>
                setSwitches((s) => ({
                  ...s,
                  features: { ...s.features, [feature]: on },
                }))
              }
            />,
          ),
        )}
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {t("save")}
      </Button>
      <Message result={result} />
      {confirming && (
        <Dialog title={t("confirmTitle")} onClose={() => setConfirming(false)}>
          <p>{t("confirm")}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="primary" onClick={commit}>
              {t("confirmYes")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </Dialog>
      )}
    </form>
  );
}

export function AnnouncementForm({
  post = postAction,
}: {
  post?: typeof postAction;
}) {
  const t = useTranslations("admin.ops");
  const router = useRouter();
  const ids = { zh: useId(), en: useId(), hours: useId(), hint: useId() };
  const [level, setLevel] = useState<AnnouncementLevel>("info");
  const [bodyZh, setBodyZh] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [hours, setHours] = useState("24");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<OpsResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const answer = await post({
      level,
      bodyZh,
      bodyEn,
      hours: hours.trim() === "" ? null : Number(hours),
    }).catch((): OpsResult => ({ ok: false, reason: "failed" }));
    setResult(answer);
    setPending(false);
    if (answer.ok) {
      setBodyZh("");
      setBodyEn("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <p aria-hidden="true" className="font-medium">
          {t("level")}
        </p>
        <SegmentedControl
          legend={t("level")}
          value={level}
          options={ANNOUNCEMENT_LEVELS.map((value) => ({
            value,
            label: t(`levels.${value}`),
          }))}
          onChange={setLevel}
          optionWidthClassName="min-w-12"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.zh} className="block font-medium">
          {t("bodyZh")}
        </label>
        <textarea
          id={ids.zh}
          required
          rows={2}
          maxLength={SITE_ANNOUNCEMENT_MAX}
          value={bodyZh}
          onChange={(e) => setBodyZh(e.target.value)}
          className={fieldClassName}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.en} className="block font-medium">
          {t("bodyEn")}
        </label>
        <textarea
          id={ids.en}
          required
          rows={2}
          lang="en"
          maxLength={SITE_ANNOUNCEMENT_MAX}
          value={bodyEn}
          onChange={(e) => setBodyEn(e.target.value)}
          className={fieldClassName}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.hours} className="block font-medium">
          {t("hours")}
        </label>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("hoursHint")}
        </p>
        <input
          id={ids.hours}
          type="number"
          min={1}
          max={720}
          inputMode="numeric"
          aria-describedby={ids.hint}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className={`${fieldClassName} max-w-40 tabular-nums`}
        />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {t("post")}
      </Button>
      <Message result={result} />
    </form>
  );
}

export function EndAnnouncementButton({
  id,
  end = endAction,
}: {
  id: string;
  end?: typeof endAction;
}) {
  const t = useTranslations("admin.ops");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const answer = await end(id).catch(() => null);
        setPending(false);
        if (answer?.ok) router.refresh();
      }}
    >
      {t("end")}
    </Button>
  );
}
