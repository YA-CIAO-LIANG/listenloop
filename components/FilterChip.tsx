"use client";

import type { ReactNode } from "react";

/**
 * A toggle button for a filter that can be on with others (design system:
 * FilterChip, D104): off is white with a gray border, on is black with
 * white text and a ✓. The ✓ and aria-pressed carry the state, not color
 * alone. Disabled (e.g. at a limit) it fades and can't be pressed.
 */
export function FilterChip({
  on,
  onToggle,
  disabled = false,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      disabled={disabled}
      className={`inline-flex h-8 items-center rounded-base border px-3 text-supporting tabular-nums transition-colors duration-(--ll-duration-transition) disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:min-h-11 ${
        on
          ? "border-ink bg-ink text-ground"
          : "border-line bg-surface text-ink enabled:hover:border-ink-muted"
      }`}
    >
      {on && <span aria-hidden="true">✓ </span>}
      {children}
    </button>
  );
}
