"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { cardClassName } from "./Card";
import { usePress } from "./usePress";

/** Clickable Card: border darkens on hover, with press and ripple feedback. */
export function CardLink({
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link>) {
  // Links activate on Enter only (Space scrolls the page).
  const { pressProps, rippleLayer } = usePress<HTMLAnchorElement>(props, {
    keys: ["Enter"],
  });

  return (
    <Link
      {...props}
      {...pressProps}
      className={`${cardClassName} pressable block hover:border-ink-muted ${className}`}
    >
      {rippleLayer}
      {children}
    </Link>
  );
}
