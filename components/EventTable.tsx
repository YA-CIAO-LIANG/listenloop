import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { userNumberLabel } from "@/lib/accounts";
import { isEventType } from "@/lib/events";

export type EventRow = {
  id: number;
  created_at: string;
  user_id: string | null;
  type: string;
  video_id: string | null;
  day: number | null;
  score: number | null;
  code: string | null;
};

/**
 * Activity events as a table (D55, D56), newest first: time, account
 * number (linked), event, practice, day, score, and code.
 */
export async function EventTable({
  events,
  numbers,
}: {
  events: readonly EventRow[];
  /** Account numbers by user id. */
  numbers: ReadonlyMap<string, number>;
}) {
  const [t, tTypes, format] = await Promise.all([
    getTranslations("admin.events"),
    getTranslations("events.types"),
    getFormatter(),
  ]);
  if (events.length === 0) {
    return <p className="mt-4 text-ink-muted">{t("none")}</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-y border-line text-supporting">
        <thead className="text-left text-ink-muted">
          <tr className="border-b border-line">
            {(
              [
                "time",
                "user",
                "type",
                "practice",
                "day",
                "score",
                "code",
              ] as const
            ).map((column) => (
              <th key={column} scope="col" className="py-2 pr-4 font-normal">
                {t(`columns.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {events.map((event) => {
            const number = event.user_id
              ? numbers.get(event.user_id)
              : undefined;
            return (
              <tr key={event.id}>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {format.dateTime(new Date(event.created_at), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {number !== undefined ? (
                    <Link
                      href={`/admin/users/${number}`}
                      className="text-accent-ink underline underline-offset-4"
                    >
                      {userNumberLabel(number)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">
                  {isEventType(event.type) ? tTypes(event.type) : event.type}
                </td>
                <td className="py-2 pr-4 break-all">
                  {event.video_id ? (
                    <Link
                      href={`/videos/${event.video_id}`}
                      className="underline underline-offset-4"
                    >
                      {event.video_id}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">{event.day ?? "—"}</td>
                <td className="py-2 pr-4">
                  {event.score === null
                    ? "—"
                    : format.number(event.score, {
                        style: "percent",
                        maximumFractionDigits: 0,
                      })}
                </td>
                <td className="py-2 break-all">{event.code ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
