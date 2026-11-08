import type { Titles } from "@/lib/titles";
import { oneLineTitle } from "@/lib/titles";

/**
 * A material's title, English first (D83): the English title, then the
 * Chinese one below it, smaller and quieter. `compact` puts both on one
 * line ("English Title｜中文標題"), cut off with an ellipsis, where
 * there's room for one line only.
 */
export function MaterialTitle({
  titles,
  as: Tag = "p",
  className = "font-display text-h3",
  zhClassName = "mt-1 block font-reading text-supporting text-ink-muted",
  compact = false,
}: {
  titles: Titles;
  as?: "p" | "h1" | "h2" | "h3" | "span";
  /** The English line's style. */
  className?: string;
  /** The Chinese line's style: smaller and quieter. */
  zhClassName?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Tag className={`truncate ${className}`} title={oneLineTitle(titles)}>
        <span lang="en">{titles.en}</span>
        {titles.zh && titles.zh !== titles.en && (
          <span className="text-ink-muted">｜{titles.zh}</span>
        )}
      </Tag>
    );
  }
  return (
    <Tag className={className}>
      <span lang="en" className="block">
        {titles.en}
      </span>
      {titles.zh && titles.zh !== titles.en && (
        <span className={zhClassName}>{titles.zh}</span>
      )}
    </Tag>
  );
}
