"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { setClassroomSeats } from "@/app/admin/users/actions";
import { CLASS_TIERS } from "@/lib/classroom";
import { PLAN_LINES, isPlanLine, type PlanLine } from "@/lib/plans";

/**
 * An admin turns a teacher's class plan on or off by hand (D103, D173),
 * choosing a tier and its line (D210). A grant from before the tiers keeps
 * showing its seats.
 */
export function ClassroomSeatsControl({
  userId,
  seats,
  line = "all",
}: {
  userId: string;
  seats: number | null;
  line?: PlanLine;
}) {
  const t = useTranslations("admin.users");
  const tn = useTranslations("planNames");
  const id = useId();
  const lineId = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<false | "failed" | "reauth">(false);
  async function save(nextSeats: number | null, nextLine: PlanLine) {
    setPending(true);
    setFailed(false);
    const result = await setClassroomSeats(userId, nextSeats, nextLine).catch(
      () => ({ ok: false as const, reason: "failed" as const }),
    );
    setPending(false);
    if (result.ok) router.refresh();
    else setFailed(result.reason === "reauth" ? "reauth" : "failed");
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id}>{t("classroom")}</label>
      <select
        id={id}
        value={seats ?? ""}
        disabled={pending}
        onChange={(event) =>
          save(event.target.value ? Number(event.target.value) : null, line)
        }
        className="h-10 rounded-base border border-line bg-surface px-2 pointer-coarse:min-h-11"
      >
        <option value="">{t("classroomNone")}</option>
        {CLASS_TIERS.map((tier) => (
          <option key={tier.id} value={tier.seats}>
            {t("classroomSeats", { seats: tier.seats })}
          </option>
        ))}
        {seats !== null &&
          !CLASS_TIERS.some((tier) => tier.seats === seats) && (
            <option value={seats} disabled>
              {t("classroomSeats", { seats })}
            </option>
          )}
      </select>
      {seats !== null && (
        <>
          <label htmlFor={lineId}>{t("classroomLine")}</label>
          <select
            id={lineId}
            value={line}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value;
              if (isPlanLine(next)) void save(seats, next);
            }}
            className="h-10 rounded-base border border-line bg-surface px-2 pointer-coarse:min-h-11"
          >
            {PLAN_LINES.map((value) => (
              <option key={value} value={value}>
                {tn(`lines.${value}`)}
              </option>
            ))}
          </select>
        </>
      )}
      {failed && (
        <span className="text-supporting text-error">
          {failed === "reauth" ? t("errors.reauth") : t("classroomFailed")}
        </span>
      )}
    </div>
  );
}
