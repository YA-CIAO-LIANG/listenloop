import type { ComponentProps } from "react";

export const cardClassName = "rounded-base border border-line bg-surface p-6";

/**
 * Framed panel: surface background, 1px line border, 4px radius, no shadow.
 * Use sparingly; most content sits directly on the page. For a clickable
 * card, use CardLink.
 */
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`${cardClassName} ${className}`} />;
}
