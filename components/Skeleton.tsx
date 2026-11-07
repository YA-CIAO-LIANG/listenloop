/**
 * Placeholder blocks while a page loads (D61): band-colored bars in the
 * shape of what's coming, gently pulsing (still with reduced motion).
 * Hidden from screen readers; the page's status line says it's loading.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-base bg-band motion-reduce:animate-none ${className}`}
    />
  );
}

/** Two cards' worth of placeholder, for a library section (D61). */
export function LibrarySkeleton({ label }: { label: string }) {
  return (
    <div className="mt-8">
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton className="h-6 w-48" />
      <div className="mt-6 grid gap-6 split:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

/**
 * A practice page while its progress loads (D62): the progress bar, the
 * player (a 16:9 video, or the shorter audio panel), the answer area, and
 * the buttons, about as tall as the real thing, so the page doesn't jump
 * when practice begins.
 */
export function PracticeSkeleton({ audio }: { audio: boolean }) {
  return (
    <div aria-hidden="true" className="space-y-4">
      <Skeleton className="h-6" />
      <Skeleton className={audio ? "h-32" : "aspect-video w-full"} />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-28" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
