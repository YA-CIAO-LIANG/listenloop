"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { setClassroomSeats } from "@/app/admin/users/actions";
import { CLASS_PLAN } from "@/lib/classroom";

/**
 * An admin turns a teacher's class plan on or off by hand (D103, D105).
 * A grant from before the single plan keeps showing its seats.
 */
export function ClassroomSeatsControl({
  userId,
  seats,
}: {
  userId: string;
  seats: number | null;
}) {
  const t = useTranslations("admin.users");
  const id = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id}>{t("classroom")}</label>
      <select
        id={id}
        value={seats ?? ""}
        disabled={pending}
        onChange={async (event) => {
          setPending(true);
          setFailed(false);
          const value = event.target.value ? Number(event.target.value) : null;
          const result = await setClassroomSeats(userId, value).catch(() => ({
            ok: false as const,
          }));
          setPending(false);
          if (result.ok) router.refresh();
          else setFailed(true);
        }}
        className="h-10 rounded-base border border-line bg-surface px-2 pointer-coarse:min-h-11"
      >
        <option value="">{t("classroomNone")}</option>
        <option value={CLASS_PLAN.seats}>
          {t("classroomSeats", { seats: CLASS_PLAN.seats })}
        </option>
        {seats !== null && seats !== CLASS_PLAN.seats && (
          <option value={seats} disabled>
            {t("classroomSeats", { seats })}
          </option>
        )}
      </select>
      {failed && (
        <span className="text-supporting text-error">
          {t("classroomFailed")}
        </span>
      )}
    </div>
  );
}
