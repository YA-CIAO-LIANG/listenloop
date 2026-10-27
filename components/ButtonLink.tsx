"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";
import { usePress } from "./usePress";

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
};

/** A link styled exactly like Button, for navigation ("Start Day 1 →"). */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  arrow = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  // Links activate on Enter only (Space scrolls the page).
  const { pressProps, rippleLayer } = usePress<HTMLAnchorElement>(props, {
    keys: ["Enter"],
  });

  return (
    <Link
      {...props}
      {...pressProps}
      className={buttonClassName({ variant, size, className, as: "link" })}
    >
      {rippleLayer}
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </Link>
  );
}
