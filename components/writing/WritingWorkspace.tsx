"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

/** The smallest the workspace gets (a short screen with the keyboard up). */
const MIN_HEIGHT_PX = 160;

/**
 * Keeps an element's bottom at the bottom of what's visible: the visual
 * viewport's bottom (above a phone's keyboard, D193) minus the element's
 * top. Recomputed on scroll, resize, and keyboard changes.
 */
export function useFitToViewport(
  ref: React.RefObject<HTMLElement | null>,
  /** The whole visible height, the page scrolled to it (the chat room). */
  { full = false }: { full?: boolean } = {},
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    let tallest = 0;
    let first = true;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const view = window.visualViewport;
        const visible = view ? view.height : window.innerHeight;
        tallest = Math.max(tallest, visible);
        // The keyboard came up while writing here: bring the whole
        // workspace into view, its top at the top of the screen.
        if (
          visible < tallest * 0.8 &&
          element.contains(document.activeElement) &&
          element.getBoundingClientRect().top > (view?.offsetTop ?? 0) + 1
        ) {
          element.scrollIntoView({ block: "start" });
        }
        const bottom = (view?.offsetTop ?? 0) + visible;
        const top = full
          ? (view?.offsetTop ?? 0)
          : Math.max(0, element.getBoundingClientRect().top);
        element.style.height = `${Math.max(MIN_HEIGHT_PX, Math.floor(bottom - top))}px`;
        // Full height: once it has its height, bring it to the top.
        if (full && first) {
          first = false;
          element.scrollIntoView({ block: "start" });
        }
      });
    };
    fit();
    // Whatever above it changes height (a notice, the header) moves it.
    const observer = new ResizeObserver(fit);
    observer.observe(document.body);
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, [ref, full]);
}

/**
 * Where the learner writes (D193): the task and the answer box in view
 * together, without scrolling the page.
 *
 * - Wide screens: the task on the left, the answer on the right, each
 *   scrolling on its own.
 * - Phones and tablets: the task as one line on top (opens to the full
 *   task and scoring points), then the audio controls, then the answer
 *   box, which takes the rest. The whole block ends at the bottom of
 *   what's visible, so with the keyboard up the box, the word count, and
 *   the button stay above it.
 */
export function WritingWorkspace({
  summary,
  task,
  audio,
  children,
  label,
  summaryLang,
}: {
  /** "en" when the summary is the English task. */
  summaryLang?: string;
  /** One line: the task, shortened. Phones only. */
  summary: ReactNode;
  /** The full task: what to write, notes, scoring points. */
  task: ReactNode;
  /** Sound controls, fixed above the answer box. */
  audio?: ReactNode;
  /** The answer box and its bar; fills the space left. */
  children: ReactNode;
  /** The answer column's name for screen readers. */
  label?: string;
}) {
  const t = useTranslations("writing.workspace");
  const ref = useRef<HTMLDivElement>(null);
  useFitToViewport(ref);
  return (
    <div
      ref={ref}
      data-testid="writing-workspace"
      className="flex h-dvh min-h-40 flex-col gap-3 wide:grid wide:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] wide:gap-8"
    >
      <details className="group shrink-0 rounded-base border border-line bg-surface wide:hidden">
        <summary className="tap flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-supporting">
          <span className="min-w-0 flex-1 truncate" lang={summaryLang}>
            {summary}
          </span>
          <span className="shrink-0 text-accent-ink group-open:hidden">
            {t("more")}
          </span>
          <span className="hidden shrink-0 text-accent-ink group-open:inline">
            {t("less")}
          </span>
        </summary>
        <div className="max-h-[45dvh] overflow-y-auto border-t border-line px-3 py-3">
          {task}
        </div>
      </details>
      <section
        aria-label={t("task")}
        className="hidden min-h-0 overflow-y-auto pr-2 wide:block"
      >
        {task}
      </section>
      <section
        aria-label={label ?? t("answer")}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        {audio && <div className="shrink-0">{audio}</div>}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {children}
        </div>
      </section>
    </div>
  );
}
