"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A modal dialog (D52) on the native <dialog>: showModal keeps focus
 * inside and makes the page behind inert; Escape calls onClose. Opens
 * when mounted, so render it only while it should show.
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    // Some test environments lack showModal; the open attribute shows it.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (typeof dialog.close === "function") dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-base border border-line bg-surface p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 id={titleId} className="font-display text-h3">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </dialog>
  );
}
