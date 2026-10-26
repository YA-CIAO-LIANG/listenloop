"use client";

import type { ComponentProps } from "react";
import { usePress } from "./usePress";

const variantClassNames = {
  primary:
    "border-accent bg-accent/14 text-accent-ink enabled:hover:bg-accent/22",
  secondary: "border-line bg-ink/4 text-ink enabled:hover:bg-ink/8",
  ghost:
    "border-transparent text-ink-muted enabled:hover:bg-ink/4 enabled:hover:text-ink",
} as const;

// Touch screens get at least 44px so buttons are easy to tap.
const sizeClassNames = {
  sm: "h-8 px-3 text-supporting pointer-coarse:min-h-11",
  md: "h-10 px-4 text-body pointer-coarse:min-h-11",
  lg: "h-12 px-6 text-body",
} as const;

export type ButtonVariant = keyof typeof variantClassNames;
export type ButtonSize = keyof typeof sizeClassNames;

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Appends a small → to the label. */
  arrow?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  arrow = false,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  const { pressProps, rippleLayer } = usePress<HTMLButtonElement>(props, {
    disabled: props.disabled,
  });

  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      {...props}
      {...pressProps}
      className={[
        "pressable inline-flex items-center justify-center gap-2 rounded-base border whitespace-nowrap backdrop-blur-sm select-none disabled:cursor-not-allowed disabled:opacity-40",
        variantClassNames[variant],
        sizeClassNames[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {rippleLayer}
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  );
}
