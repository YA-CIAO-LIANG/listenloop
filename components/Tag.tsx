import type { ReactNode } from "react";

/**
 * A small label on a card (design system: Tag, D70): type, category,
 * level. 1px line border, 4px radius, metadata size. Information only,
 * never a control; filters use FilterChip. The accent tone marks one
 * highlighted item, such as the most popular plan (D173).
 */
export function Tag({
  icon,
  tone = "default",
  children,
}: {
  icon?: ReactNode;
  tone?: "default" | "accent";
  children: ReactNode;
}) {
  const colors =
    tone === "accent"
      ? "border-accent text-accent-ink"
      : "border-line text-ink-muted";
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1 rounded-base border px-2 text-metadata ${colors}`}
    >
      {icon}
      {children}
    </span>
  );
}
