import type { Metadata } from "next";
import { ScrollRegion } from "@/components/ScrollRegion";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  assignableMaterials,
  assignedMaterials,
  classDetail,
  classProgressRows,
} from "@/auth/classroom";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import {
  AnnouncementForm,
  ApplyRulesButton,
  AssignmentForm,
  DeleteAnnouncementButton,
  DeleteAssignmentButton,
  LeaveClassButton,
  RemoveStudentButton,
} from "@/components/ClassroomForms";
import { Tag } from "@/components/Tag";
import { classReport } from "@/lib/classroom";
import { parseProgress } from "@/lib/progress";
import { getAllVideos } from "@/lib/video-library";

export async function generateMetadata({
  params,
}: PageProps<"/classroom/[id]">): Promise<Metadata> {
  const detail = await classDetail((await params).id);
  return {
    title: detail?.name ?? "",
    robots: { index: false, follow: false },
  };
}

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * One class (D103). Its teacher sees the invite, the students (and can
 * remove them), assignments with each student's progress, Day 1 → Day 7,
 * what the class misheard most, who hasn't finished, a CSV, and the
 * announcements. A student sees the announcements and their assignments
 * with due dates and where they are; nothing about classmates.
 */
export default async function ClassPage({
  params,
}: PageProps<"/classroom/[id]">) {
  const { id } = await params;
  const [t, format, user, detail] = await Promise.all([
    getTranslations("classroom"),
    getFormatter(),
    getSignedInUser(),
    classDetail(id),
  ]);
  if (!user || !detail) notFound();
  const percent = (n: number | null) =>
    n === null
      ? "—"
      : format.number(n, { style: "percent", maximumFractionDigits: 0 });
  const date = (iso: string) =>
    format.dateTime(new Date(`${iso.slice(0, 10)}T12:00:00Z`), {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  const announcements = (
    <section className="space-y-4" aria-labelledby="announcements">
      <h2 id="announcements" className="font-display text-h2">
        {t("announcements")}
      </h2>
      {detail.teacher && <AnnouncementForm classId={id} />}
      {detail.announcements.length === 0 ? (
        <p className="text-ink-muted">{t("noAnnouncements")}</p>
      ) : (
        <ul className="space-y-3">
          {detail.announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-base border border-line surface-card p-4"
            >
              <p className="whitespace-pre-line">{a.body}</p>
              <p className="mt-2 flex flex-wrap items-center gap-3 text-metadata text-ink-muted">
                {date(a.createdAt)}
                {detail.teacher && (
                  <DeleteAnnouncementButton classId={id} id={a.id} />
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  if (!detail.teacher) {
    // The student's own progress on each assignment (their rows only).
    const supabase = await getServerSupabase();
    const { data: rows } = supabase
      ? await supabase
          .from("progress")
          .select("video_id, data")
          .eq("user_id", user.id)
          .in(
            "video_id",
            detail.assignments.map((a) => a.videoId),
          )
      : { data: [] };
    const mine = new Map(
      (rows ?? []).map((r) => [r.video_id, parseProgress(r.data)]),
    );
    return (
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
        <Link
          href="/classroom"
          className="tap text-supporting text-ink-muted hover:text-ink"
        >
          <span aria-hidden="true">← </span>
          {t("title")}
        </Link>
        <h1 className="mt-4 font-display text-h1">{detail.name}</h1>
        <div className="mt-10 space-y-12">
          {announcements}
          <section className="space-y-4" aria-labelledby="assignments">
            <h2 id="assignments" className="font-display text-h2">
              {t("assignments")}
            </h2>
            {detail.assignments.length === 0 ? (
              <p className="text-ink-muted">{t("noAssignments")}</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {detail.assignments.map((a) => {
                  const progress = mine.get(a.videoId) ?? null;
                  const done =
                    progress?.status === "passed" ||
                    progress?.status === "repeat";
                  const days = progress
                    ? Object.values(progress.days).filter((d) => d?.done).length
                    : 0;
                  return (
                    <li key={a.id} className="space-y-2 py-4">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/videos/${a.videoId}`}
                          className={linkClassName}
                        >
                          {a.title}
                        </Link>
                        {done ? (
                          <Tag>{t("statusDone")}</Tag>
                        ) : progress ? (
                          <Tag>{t("statusDay", { days })}</Tag>
                        ) : (
                          <Tag>{t("statusNotStarted")}</Tag>
                        )}
                      </p>
                      <p className="text-supporting text-ink-muted">
                        {t("dates", {
                          start: date(a.startsOn),
                          due: date(a.dueOn),
                        })}
                      </p>
                      {/* One clear next step for each assignment (D179). */}
                      <ButtonLink
                        href={
                          done
                            ? `/videos/${a.videoId}`
                            : `/videos/${a.videoId}/day/${Math.min(7, days + 1)}`
                        }
                        variant={done ? "secondary" : "primary"}
                        size="sm"
                      >
                        {done
                          ? t("seeResult")
                          : days === 0
                            ? t("startDay1")
                            : t("continueDay", { day: Math.min(7, days + 1) })}
                      </ButtonLink>
                      {a.rules !== null && (
                        <ApplyRulesButton videoId={a.videoId} rules={a.rules} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <LeaveClassButton classId={id} />
        </div>
      </main>
    );
  }

  const [rows, materials, ownMaterials] = await Promise.all([
    classProgressRows(id),
    assignedMaterials(detail.assignments.map((a) => a.videoId)),
    assignableMaterials(),
  ]);
  const reports = classReport(
    detail.members,
    detail.assignments,
    rows,
    materials,
  );
  const choices = [
    ...getAllVideos().map((v) => ({ id: v.id, title: v.title })),
    ...ownMaterials,
  ];
  const invite = `/classroom/join/${detail.inviteCode}`;

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/classroom"
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("title")}
      </Link>
      <h1 className="mt-4 font-display text-h1">{detail.name}</h1>
      <p className="mt-4 text-ink-muted">
        {t("inviteHint")}{" "}
        <span className="font-mono text-ink">{detail.inviteCode}</span> ·{" "}
        <Link href={invite} className={linkClassName}>
          {t("inviteLink")}
        </Link>
      </p>

      <div className="mt-10 space-y-12">
        <section className="space-y-4" aria-labelledby="students">
          <h2 id="students" className="font-display text-h2">
            {t("students", { count: detail.members.length })}
          </h2>
          {detail.members.length === 0 ? (
            <p className="text-ink-muted">{t("noStudents")}</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {detail.members.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>{m.displayName}</span>
                  <RemoveStudentButton
                    classId={id}
                    userId={m.userId}
                    name={m.displayName}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4" aria-labelledby="assign">
          <h2 id="assign" className="font-display text-h2">
            {t("assignTitle")}
          </h2>
          <AssignmentForm classId={id} materials={choices} />
        </section>

        <section className="space-y-6" aria-labelledby="progress">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="progress" className="font-display text-h2">
              {t("progressTitle")}
            </h2>
            {reports.length > 0 && (
              <a
                href={`/classroom/${id}/export`}
                className={`${linkClassName} tap`}
                download
              >
                {t("exportCsv")}
              </a>
            )}
          </div>
          {reports.length === 0 && (
            <p className="text-ink-muted">{t("noAssignments")}</p>
          )}
          {reports.map(({ assignment, students, unfinished, missedWords }) => (
            <article
              key={assignment.id}
              className="space-y-3 rounded-base border border-line surface-card p-4"
            >
              <h3 className="flex flex-wrap items-center gap-2 font-display text-h3">
                {assignment.title}
                <DeleteAssignmentButton
                  classId={id}
                  id={assignment.id}
                  title={assignment.title}
                />
              </h3>
              <p className="text-supporting text-ink-muted">
                {t("dates", {
                  start: date(assignment.startsOn),
                  due: date(assignment.dueOn),
                })}
              </p>
              <ScrollRegion label={assignment.title}>
                <table className="w-full min-w-150 text-left text-supporting tabular-nums">
                  <thead>
                    <tr className="border-b border-line">
                      <th
                        scope="col"
                        className="py-2 pr-3 font-normal text-ink-muted"
                      >
                        {t("student")}
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 font-normal text-ink-muted"
                      >
                        {t("day")}
                      </th>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <th
                          key={d}
                          scope="col"
                          className="px-2 py-2 font-normal text-ink-muted"
                        >
                          {t("dayN", { day: d })}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="px-2 py-2 font-normal text-ink-muted"
                      >
                        {t("improvement")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.userId} className="border-b border-line">
                        <th scope="row" className="py-2 pr-3 font-normal">
                          {s.displayName}
                        </th>
                        <td className="px-2 py-2">
                          {!s.started
                            ? t("statusNotStarted")
                            : s.finished
                              ? s.passed
                                ? t("passed")
                                : t("repeat")
                              : t("onDay", { day: s.nextDay ?? 1 })}
                        </td>
                        {s.dayScores.map((score, i) => (
                          <td key={i} className="px-2 py-2">
                            {percent(score)}
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          {s.improvement === null
                            ? "—"
                            : t("points", { points: s.improvement })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
              <p className="text-supporting">
                <span className="text-ink-muted">{t("unfinished")}</span>{" "}
                {unfinished.length === 0 ? t("none") : unfinished.join("、")}
              </p>
              <p className="text-supporting">
                <span className="text-ink-muted">{t("missed")}</span>{" "}
                {missedWords.length === 0 ? (
                  t("none")
                ) : (
                  <span lang="en">
                    {missedWords
                      .map((w) => `${w.word} (${w.count})`)
                      .join(", ")}
                  </span>
                )}
              </p>
            </article>
          ))}
        </section>

        {announcements}
      </div>
    </main>
  );
}
