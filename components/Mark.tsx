import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export type MarkKind = "miss" | "key";

/**
 * The highlighter (D66): "miss" for what the learner misheard or missed,
 * "key" for a sentence's one or two key words. Never color alone: each
 * has its own underline (solid / dotted) and says what it is to screen
 * readers ("你聽錯的字：", "重點："). Mark a whole run of words at once,
 * so the label is read once.
 */
export function Mark({
  kind,
  children,
}: {
  kind: MarkKind;
  children: ReactNode;
}) {
  const t = useTranslations("marks");
  return (
    <mark className={kind === "miss" ? "mark-miss" : "mark-key"}>
      <span className="sr-only">{t(`${kind}Label`)}</span>
      {children}
    </mark>
  );
}

/** The two marks side by side with their names: a legend for a section. */
export function MarkLegend({ kinds }: { kinds: readonly MarkKind[] }) {
  const t = useTranslations("marks");
  return (
    <p
      className="flex flex-wrap gap-x-4 gap-y-1 text-supporting text-ink-muted"
      aria-hidden="true"
    >
      {kinds.map((kind) => (
        <span key={kind}>
          <mark className={kind === "miss" ? "mark-miss" : "mark-key"}>
            {t(`${kind}Sample`)}
          </mark>{" "}
          {t(`${kind}Name`)}
        </span>
      ))}
    </p>
  );
}
