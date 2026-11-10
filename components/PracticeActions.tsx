"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * How far the on-screen keyboard (or pinch zoom) pushes the visible
 * area's bottom above the layout viewport's (D124), so a bar fixed to the
 * bottom stays above the keyboard on iOS and Android. 0 on desktops and
 * browsers without the Visual Viewport API.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setInset(
        Math.max(
          0,
          Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
        ),
      );
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * The practice buttons (D124): the other controls on the left and the
 * main action ("Submit", "Next", "Play and shadow") always on the right,
 * so it's in the same place for every sentence. On phones (< sm) the main
 * action sits in a bar fixed to the bottom of the screen, where the thumb
 * is, lifted above the keyboard; put PracticeActionsSpacer at the end of
 * the page so the bar never hides the last lines.
 */
export function PracticeActions({
  primary,
  children,
}: {
  primary: ReactNode;
  children?: ReactNode;
}) {
  const inset = useKeyboardInset();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      <div
        data-practice-primary=""
        style={{ "--ll-keyboard": `${inset}px` } as CSSProperties}
        className="ml-auto flex justify-end max-sm:fixed max-sm:inset-x-0 max-sm:bottom-(--ll-keyboard) max-sm:z-20 max-sm:border-t max-sm:border-line max-sm:bg-ground max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:[&>*]:min-w-40"
      >
        {primary}
      </div>
    </div>
  );
}

/** Room at the end of a practice page for the phone's bottom bar. */
export function PracticeActionsSpacer() {
  return <div aria-hidden="true" className="h-24 sm:hidden" />;
}
