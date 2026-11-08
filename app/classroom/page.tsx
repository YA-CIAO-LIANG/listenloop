import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { myClasses } from "@/auth/classroom";
import { getSignedInUser } from "@/auth/session";
import { ButtonLink } from "@/components/ButtonLink";
import { CreateClassForm, JoinClassForm } from "@/components/ClassroomForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("classroom");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * My classes (D103): a student's classes and joining one with a code; a
 * teacher's classes and making one (with a class plan; others see the
 * class plans).
 */
export default async function ClassroomPage() {
  const [t, user] = await Promise.all([
    getTranslations("classroom"),
    getSignedInUser(),
  ]);
  if (!user) {
    return (
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
        <h1 className="font-display text-h1">{t("title")}</h1>
        <p className="mt-4 max-w-reading text-ink-muted">{t("signInFirst")}</p>
        <div className="mt-6">
          <ButtonLink href="/login?next=%2Fclassroom" variant="primary" arrow>
            {t("signIn")}
          </ButtonLink>
        </div>
      </main>
    );
  }
  const classes = await myClasses();
  const joined = classes.filter((c) => !c.teacher);
  const teaching = classes.filter((c) => c.teacher);
  const teacher = user.classroomSeats !== null || user.role === "admin";
  const seats = user.classroomSeats ?? 100;
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <section className="mt-10 space-y-4" aria-labelledby="joined">
        <h2 id="joined" className="font-display text-h2">
          {t("myClasses")}
        </h2>
        {joined.length === 0 ? (
          <p className="text-ink-muted">{t("noClasses")}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {joined.map((c) => (
              <li key={c.id} className="py-3">
                <Link
                  href={`/classroom/${c.id}`}
                  className="tap font-medium underline-offset-4 hover:underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-display text-h3">{t("joinTitle")}</h3>
        <JoinClassForm />
      </section>

      <section
        className="mt-12 space-y-4 border-t border-line pt-8"
        aria-labelledby="teaching"
      >
        <h2 id="teaching" className="font-display text-h2">
          {t("teaching")}
        </h2>
        {teacher ? (
          <>
            <p className="text-supporting text-ink-muted">
              {t("teacherPlan", { seats })}
            </p>
            {teaching.length > 0 && (
              <ul className="divide-y divide-line border-y border-line">
                {teaching.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                  >
                    <Link
                      href={`/classroom/${c.id}`}
                      className="tap font-medium underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="text-supporting text-ink-muted tabular-nums">
                      {t("studentsOf", { count: c.students, seats })} ·{" "}
                      {t("codeShort")}{" "}
                      <span className="font-mono">{c.inviteCode}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <CreateClassForm />
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-ink-muted">{t("teacherPitch")}</p>
            <ButtonLink
              href="/pricing/classroom?from=classroom"
              variant="secondary"
              arrow
            >
              {t("seeClassPlans")}
            </ButtonLink>
          </div>
        )}
      </section>
    </main>
  );
}
