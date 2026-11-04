"use client";

import type { ReactNode } from "react";

/**
 * A toggle button for a filter that can be on with others (design system:
 * FilterChip). The ✓ and aria-pressed carry the state, not color alone.
 */
export function FilterChip({
  on,
  onToggle,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`inline-flex h-8 items-center rounded-base border px-3 text-supporting tabular-nums transition-colors duration-(--ll-duration-transition) pointer-coarse:min-h-11 ${
        on
          ? "border-ink bg-ink text-ground"
          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
      }`}
    >
      {on && <span aria-hidden="true">✓ </span>}
      {children}
    </button>
  );
}
