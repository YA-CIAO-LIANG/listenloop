import type { ReactNode } from "react";

/**
 * A wide table that scrolls sideways on small screens. It can take focus
 * (tabIndex 0) and is a named region, so keyboard users can scroll it
 * with the arrow keys (WCAG 2.1.1; axe: scrollable-region-focusable).
 */
export function ScrollRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative w-full max-w-full overflow-x-auto rounded-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </div>
  );
}
