"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CATEGORY_IDS, EXAM_CATEGORY, EXAMS } from "@/lib/categories";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import { FilterChip } from "./FilterChip";
import { PracticeCard } from "./PracticeCard";

/**
 * Official practices with filters (D57): one category at a time, and for
 * exam listening one exam. Only categories that have practices show a
 * chip; pressing the chosen one again shows everything.
 */
export function OfficialLibrary({
  practices,
}: {
  practices: readonly PublicPracticeSummary[];
}) {
  const t = useTranslations("library.official");
  const tc = useTranslations("categories");
  const ids = useId();
  const [category, setCategory] = useState<string | null>(null);
  const [exam, setExam] = useState<string | null>(null);

  const categories = CATEGORY_IDS.filter((id) =>
    practices.some((p) => p.category === id),
  );
  const exams = EXAMS.filter((e) =>
    practices.some((p) => p.category === EXAM_CATEGORY && p.exam === e.id),
  );
  const shown = practices.filter(
    (p) =>
      (category === null || p.category === category) &&
      (exam === null || p.exam === exam),
  );

  return (
    <>
      {categories.length > 1 && (
        <div className="mt-4 space-y-2">
          <div
            role="group"
            aria-labelledby={`${ids}-category`}
            className="flex flex-wrap items-center gap-2"
          >
            <span
              id={`${ids}-category`}
              className="mr-2 text-metadata tracking-widest text-ink-muted uppercase"
            >
              {t("filterCategory")}
            </span>
            {categories.map((id) => (
              <FilterChip
                key={id}
                on={category === id}
                onToggle={() => {
                  setCategory(category === id ? null : id);
                  setExam(null);
                }}
              >
                {tc(`names.${id}`)}
              </FilterChip>
            ))}
          </div>
          {category === EXAM_CATEGORY && exams.length > 1 && (
            <div
              role="group"
              aria-labelledby={`${ids}-exam`}
              className="flex flex-wrap items-center gap-2"
            >
              <span
                id={`${ids}-exam`}
                className="mr-2 text-metadata tracking-widest text-ink-muted uppercase"
              >
                {t("filterExam")}
              </span>
              {exams.map((e) => (
                <FilterChip
                  key={e.id}
                  on={exam === e.id}
                  onToggle={() => setExam(exam === e.id ? null : e.id)}
                >
                  {tc(`exams.${e.id}`)}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}
      <ul className="mt-6 grid gap-6 split:grid-cols-2">
        {shown.map((practice) => (
          <li key={practice.id}>
            <PracticeCard practice={practice} />
          </li>
        ))}
      </ul>
    </>
  );
}
