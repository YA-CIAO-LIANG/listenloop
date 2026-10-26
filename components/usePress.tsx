"use client";

import {
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type Ripple = { id: number; x: number; y: number; size: number };

type PressHandlers<T extends HTMLElement> = {
  onPointerDown?: (event: PointerEvent<T>) => void;
  onPointerUp?: (event: PointerEvent<T>) => void;
  onPointerLeave?: (event: PointerEvent<T>) => void;
  onPointerCancel?: (event: PointerEvent<T>) => void;
  onKeyDown?: (event: KeyboardEvent<T>) => void;
  onKeyUp?: (event: KeyboardEvent<T>) => void;
  onBlur?: (event: FocusEvent<T>) => void;
};

type PressOptions = {
  disabled?: boolean;
  /** Keys that activate the element. Links only respond to Enter. */
  keys?: readonly string[];
};

/**
 * Press feedback from docs/design-system.md 點擊動畫: sets `data-pressed`
 * (scaled by the `pressable` utility) and renders a ripple from the pointer,
 * or from the center for keyboard presses. The caller's own handlers in
 * `props` still run.
 */
export function usePress<T extends HTMLElement>(
  props: PressHandlers<T>,
  { disabled = false, keys = ["Enter", " "] }: PressOptions = {},
) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  function addRipple(element: T, x: number, y: number) {
    const { width, height } = element.getBoundingClientRect();
    // Diameter that covers the element from the starting point.
    const size =
      2 * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    const id = nextId.current++;
    setRipples((current) => [...current, { id, x, y, size }]);
  }

  function release() {
    setPressed(false);
  }

  const pressProps = {
    "data-pressed": pressed ? "" : undefined,
    onPointerDown(event: PointerEvent<T>) {
      props.onPointerDown?.(event);
      if (disabled || event.button !== 0) return;
      setPressed(true);
      const rect = event.currentTarget.getBoundingClientRect();
      addRipple(
        event.currentTarget,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    onPointerUp(event: PointerEvent<T>) {
      props.onPointerUp?.(event);
      release();
    },
    onPointerLeave(event: PointerEvent<T>) {
      props.onPointerLeave?.(event);
      release();
    },
    onPointerCancel(event: PointerEvent<T>) {
      props.onPointerCancel?.(event);
      release();
    },
    onKeyDown(event: KeyboardEvent<T>) {
      props.onKeyDown?.(event);
      if (disabled || event.repeat || !keys.includes(event.key)) return;
      setPressed(true);
      const { width, height } = event.currentTarget.getBoundingClientRect();
      addRipple(event.currentTarget, width / 2, height / 2);
    },
    onKeyUp(event: KeyboardEvent<T>) {
      props.onKeyUp?.(event);
      if (keys.includes(event.key)) release();
    },
    onBlur(event: FocusEvent<T>) {
      props.onBlur?.(event);
      release();
    },
  };

  const rippleLayer = ripples.map((ripple) => (
    <span
      key={ripple.id}
      aria-hidden="true"
      data-ripple=""
      className="pointer-events-none absolute -z-10 animate-ripple bg-accent/25 motion-reduce:hidden"
      style={{
        left: ripple.x - ripple.size / 2,
        top: ripple.y - ripple.size / 2,
        width: ripple.size,
        height: ripple.size,
        borderRadius: "50%",
      }}
      onAnimationEnd={() =>
        setRipples((current) => current.filter(({ id }) => id !== ripple.id))
      }
    />
  ));

  return { pressed, pressProps, rippleLayer };
}
