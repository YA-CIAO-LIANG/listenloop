"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  createAssignment,
  createClass,
  deleteAnnouncement,
  deleteAssignment,
  joinClass,
  leaveClass,
  postAnnouncement,
  removeStudent,
  type ClassResult,
} from "@/app/classroom/actions";
import {
  ANNOUNCEMENT_MAX,
  CLASS_NAME_MAX,
  DISPLAY_NAME_MAX,
} from "@/lib/classroom";
import { toLocalDate } from "@/lib/dates";
import {
  DEFAULT_PASS_RULES,
  isPassRules,
  type PassRules,
} from "@/lib/pass-rules";
import { Button } from "./Button";
import { useStores } from "./StoresProvider";

const fieldClassName =
  "block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent";

function useRun() {
  const t = useTranslations("classroom");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<ClassResult>): Promise<ClassResult> {
    setPending(true);
    setError(null);
    const result = await action().catch((): ClassResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (result.ok) router.refresh();
    else setError(t(`errors.${result.reason}`));
    return result;
  }
  const message = error && (
    <p role="alert" className="text-supporting text-error">
      {error}
    </p>
  );
  return { pending, run, message };
}

/** A teacher names a new class (D103). */
export function CreateClassForm() {
  const t = useTranslations("classroom");
  const id = useId();
  const [name, setName] = useState("");
  const { pending, run, message } = useRun();
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await run(() => createClass(name));
        if (result.ok) setName("");
      }}
    >
      <label htmlFor={id} className="block font-medium">
        {t("newClass")}
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id={id}
          value={name}
          maxLength={CLASS_NAME_MAX}
          placeholder={t("newClassPlaceholder")}
          onChange={(event) => setName(event.target.value)}
          className={`${fieldClassName} max-w-sm flex-1`}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !name.trim()}
        >
          {t("create")}
        </Button>
      </div>
      {message}
    </form>
  );
}

/**
 * A student joins with the code, gives the name the teacher sees, and
 * says whether they're 18 or older; under 18, a parent or guardian must
 * have agreed (the terms, D103).
 */
export function JoinClassForm({ code: initialCode = "" }: { code?: string }) {
  const t = useTranslations("classroom");
  const ids = { code: useId(), name: useId() };
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [age, setAge] = useState<"adult" | "minor" | null>(null);
  const { pending, run, message } = useRun();
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await run(() =>
          joinClass({ code, name, consent: age === "minor" }),
        );
        if (result.ok && result.id) router.push(`/classroom/${result.id}`);
      }}
    >
      <div className="space-y-1">
        <label htmlFor={ids.code} className="block font-medium">
          {t("code")}
        </label>
        <input
          id={ids.code}
          value={code}
          maxLength={8}
          autoCapitalize="characters"
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className={`${fieldClassName} font-mono max-w-48 tracking-widest`}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={ids.name} className="block font-medium">
          {t("displayName")}
        </label>
        <input
          id={ids.name}
          value={name}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          className={fieldClassName}
        />
        <p className="text-supporting text-ink-muted">{t("displayNameHint")}</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="font-medium">{t("ageLegend")}</legend>
        {(["adult", "minor"] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-start gap-3">
            <input
              type="radio"
              name="age"
              checked={age === value}
              onChange={() => setAge(value)}
              className="mt-1 size-4"
            />
            <span>{t(`age.${value}`)}</span>
          </label>
        ))}
        <p className="text-supporting text-ink-muted">{t("under13")}</p>
      </fieldset>
      <Button
        type="submit"
        variant="primary"
        disabled={pending || code.length !== 8 || !name.trim() || age === null}
      >
        {t("join")}
      </Button>
      {message}
    </form>
  );
}

export function RemoveStudentButton({
  classId,
  userId,
  name,
}: {
  classId: string;
  userId: string;
  name: string;
}) {
  const t = useTranslations("classroom");
  const [confirming, setConfirming] = useState(false);
  const { pending, run, message } = useRun();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => run(() => removeStudent(classId, userId))}
          >
            {t("confirmRemove", { name })}
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
          aria-label={t("removeLabel", { name })}
          onClick={() => setConfirming(true)}
        >
          {t("remove")}
        </Button>
      )}
      {message}
    </span>
  );
}

export function LeaveClassButton({ classId }: { classId: string }) {
  const t = useTranslations("classroom");
  const router = useRouter();
  const { pending, run, message } = useRun();
  return (
    <span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const result = await run(() => leaveClass(classId));
          if (result.ok) router.push("/classroom");
        }}
      >
        {t("leave")}
      </Button>
      {message}
    </span>
  );
}

/**
 * A teacher assigns a material (D103): which one, from when to when, and
 * what passes (the defaults, or Day 7 at 80% as before).
 */
export function AssignmentForm({
  classId,
  materials,
}: {
  classId: string;
  materials: { id: string; title: string }[];
}) {
  const t = useTranslations("classroom");
  const ids = {
    material: useId(),
    starts: useId(),
    due: useId(),
    rules: useId(),
  };
  const today = toLocalDate(new Date());
  const [videoId, setVideoId] = useState(materials[0]?.id ?? "");
  const [startsOn, setStartsOn] = useState(today);
  const [dueOn, setDueOn] = useState(today);
  const [rule, setRule] = useState<"default" | "eighty">("default");
  const { pending, run, message } = useRun();
  const rules: PassRules | null =
    rule === "eighty"
      ? { ...DEFAULT_PASS_RULES, day7: { kind: "score", min: 0.8 } }
      : null;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() =>
          createAssignment({ classId, videoId, startsOn, dueOn, rules }),
        );
      }}
    >
      <div className="space-y-1">
        <label htmlFor={ids.material} className="block font-medium">
          {t("material")}
        </label>
        <select
          id={ids.material}
          value={videoId}
          onChange={(event) => setVideoId(event.target.value)}
          className={`${fieldClassName} min-w-0`}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        <label htmlFor={ids.starts} className="space-y-1">
          <span className="block font-medium">{t("startsOn")}</span>
          <input
            id={ids.starts}
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            className={fieldClassName}
          />
        </label>
        <label htmlFor={ids.due} className="space-y-1">
          <span className="block font-medium">{t("dueOn")}</span>
          <input
            id={ids.due}
            type="date"
            value={dueOn}
            min={startsOn}
            onChange={(event) => setDueOn(event.target.value)}
            className={fieldClassName}
          />
        </label>
        <label htmlFor={ids.rules} className="space-y-1">
          <span className="block font-medium">{t("rules")}</span>
          <select
            id={ids.rules}
            value={rule}
            onChange={(event) =>
              setRule(event.target.value as "default" | "eighty")
            }
            className={fieldClassName}
          >
            <option value="default">{t("rulesDefault")}</option>
            <option value="eighty">{t("rulesEighty")}</option>
          </select>
        </label>
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={pending || !videoId || dueOn < startsOn}
      >
        {t("assign")}
      </Button>
      {message}
    </form>
  );
}

export function DeleteAssignmentButton({
  classId,
  id,
  title,
}: {
  classId: string;
  id: string;
  title: string;
}) {
  const t = useTranslations("classroom");
  const { pending, run, message } = useRun();
  return (
    <span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("deleteAssignmentLabel", { title })}
        disabled={pending}
        onClick={() => run(() => deleteAssignment(classId, id))}
      >
        {t("delete")}
      </Button>
      {message}
    </span>
  );
}

export function AnnouncementForm({ classId }: { classId: string }) {
  const t = useTranslations("classroom");
  const id = useId();
  const [body, setBody] = useState("");
  const { pending, run, message } = useRun();
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await run(() => postAnnouncement(classId, body));
        if (result.ok) setBody("");
      }}
    >
      <label htmlFor={id} className="block font-medium">
        {t("newAnnouncement")}
      </label>
      <textarea
        id={id}
        rows={3}
        value={body}
        maxLength={ANNOUNCEMENT_MAX}
        onChange={(event) => setBody(event.target.value)}
        className={`${fieldClassName} resize-y`}
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || !body.trim()}
      >
        {t("post")}
      </Button>
      {message}
    </form>
  );
}

export function DeleteAnnouncementButton({
  classId,
  id,
}: {
  classId: string;
  id: string;
}) {
  const t = useTranslations("classroom");
  const { pending, run } = useRun();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => deleteAnnouncement(classId, id))}
    >
      {t("delete")}
    </Button>
  );
}

/**
 * A student uses the teacher's pass rules for an assignment (D92, D103):
 * saved in their progress for that material, like their own settings.
 */
export function ApplyRulesButton({
  videoId,
  rules,
}: {
  videoId: string;
  rules: unknown;
}) {
  const t = useTranslations("classroom");
  const { progress } = useStores();
  const [state, setState] = useState<"idle" | "done" | "notStarted">("idle");
  if (!isPassRules(rules)) return null;
  if (state === "notStarted") {
    return (
      <span className="text-supporting text-ink-muted">{t("startFirst")}</span>
    );
  }
  return state === "done" ? (
    <span className="text-supporting text-success">
      <span aria-hidden="true">✓ </span>
      {t("rulesApplied")}
    </span>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        const saved = await progress.get(videoId).catch(() => null);
        if (!saved) {
          setState("notStarted");
          return;
        }
        await progress.save({ ...saved, rules });
        setState("done");
      }}
    >
      {t("applyRules")}
    </Button>
  );
}
