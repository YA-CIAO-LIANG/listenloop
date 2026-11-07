import type { ReactNode } from "react";

/**
 * A small label on a card (design system: Tag, D70): type, category,
 * level. 1px line border, 4px radius, metadata size. Information only,
 * never a control; filters use FilterChip.
 */
export function Tag({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-base border border-line px-2 text-metadata text-ink-muted">
      {icon}
      {children}
    </span>
  );
}
