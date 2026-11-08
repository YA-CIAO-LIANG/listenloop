"use client";

import { MaterialTitle } from "./MaterialTitle";
import { useTranslations } from "next-intl";
import { isExamId, targetMessageKey } from "@/lib/categories";
import { estimateMinutes, type LibraryItem } from "@/lib/library";
import { minutesAndSeconds } from "@/lib/excerpt-length";
import { CardLink } from "./CardLink";
import { SpeakerIcon, VideoIcon } from "./icons";
import { Tag } from "./Tag";
import { VideoProgressLabel } from "./VideoProgressLabel";

/**
 * One material in the library, /explore, and wherever materials are
 * listed (D70): its type, category and level (as words, not colors),
 * exam and target, title and subtitle, the viewer's day and progress,
 * then length, accent, and about how long a day's practice takes.
 */
export function MaterialCard({
  item,
  mine = false,
}: {
  item: LibraryItem;
  /** Made by the viewer (/explore). */
  mine?: boolean;
}) {
  const t = useTranslations("library.card");
  const tAll = useTranslations();
  const tCategories = useTranslations("categories");
  const Icon = item.kind === "video" ? VideoIcon : SpeakerIcon;
  const exam = isExamId(item.exam) ? item.exam : null;

  return (
    <CardLink href={`/videos/${item.id}`} className="flex h-full flex-col">
      <p className="flex flex-wrap gap-2">
        <Tag icon={<Icon className="size-4" />}>
          {tAll(`library.kinds.${item.kind}`)}
        </Tag>
        {item.category && (
          <Tag>{tAll(`categories.names.${item.category}`)}</Tag>
        )}
        {item.level && <Tag>{tAll(`video.levels.${item.level}`)}</Tag>}
        {mine && <Tag>{t("mine")}</Tag>}
      </p>
      {exam && (
        <p className="mt-3 text-supporting text-ink-muted">
          {tAll(`categories.exams.${exam}`)}
          {item.examTarget &&
            ` · ${t("target", {
              target: tCategories(
                `targets.${targetMessageKey(item.examTarget)}` as "targets.toefl-80",
              ),
            })}`}
        </p>
      )}
      <MaterialTitle
        titles={{ en: item.title, zh: item.titleZh }}
        className="mt-4 font-display text-h3"
      />
      {item.subtitle && (
        <p className="mt-1 text-supporting text-ink-muted">{item.subtitle}</p>
      )}
      <VideoProgressLabel videoId={item.id} />
      <p className="mt-auto flex items-end justify-between gap-4 pt-4 text-supporting text-ink-muted">
        <span>
          {t("length", minutesAndSeconds(item.seconds))}
          {item.accent && ` · ${tAll(`voicePicker.accents.${item.accent}`)}`}
          {" · "}
          {t("perDay", { minutes: estimateMinutes(item.seconds) })}
        </span>
        <span aria-hidden="true">→</span>
      </p>
    </CardLink>
  );
}
