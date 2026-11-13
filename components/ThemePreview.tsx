import type { AccentId } from "@/lib/accents";
import type { BackgroundId } from "@/lib/backgrounds";

/**
 * A live miniature of a theme (D166): the home page (left) and a practice
 * page (right), drawn with the theme's own tokens (no screenshots), so it
 * always matches what the theme really looks like. Decorative: the name
 * and status next to it say what it is. Text is drawn as bars, so the
 * preview has no tiny text to read or to fail contrast.
 *
 * `scheme` pins light or dark; without it the preview follows the page.
 * `accent` is the learner's own accent color (D93), which wins over the
 * theme's, as on the real page.
 */
export function ThemePreview({
  id,
  scheme,
  accent,
  className = "",
}: {
  id: BackgroundId;
  scheme?: "light" | "dark";
  accent?: AccentId | null;
  className?: string;
}) {
  const preview = (
    <span
      data-bg={id}
      data-accent={accent ?? undefined}
      className="bg-swatch grid h-full grid-cols-2 gap-2 p-2 text-ink"
    >
      <HomeMock />
      <PracticeMock />
    </span>
  );
  return (
    <span
      aria-hidden="true"
      className={`block overflow-hidden rounded-base border border-line ${className}`}
    >
      {scheme ? (
        <span data-theme={scheme} className="block h-full">
          {preview}
        </span>
      ) : (
        preview
      )}
    </span>
  );
}

const bar = "block h-1 rounded-full";

function PrimaryButton() {
  return (
    <span className="block h-3 w-1/2 rounded-base border border-accent bg-accent/14" />
  );
}

function HomeMock() {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {/* Header: logo dot and links. */}
      <span className="flex items-center gap-1">
        <span className="block size-2 rounded-full bg-accent" />
        <span className={`${bar} w-1/4 bg-ink`} />
        <span className={`${bar} ml-auto w-1/6 bg-ink-muted`} />
      </span>
      {/* Heading and a line of muted text. */}
      <span className="mt-1 block h-2 w-3/4 rounded-full bg-ink" />
      <span className={`${bar} w-1/2 bg-ink-muted`} />
      {/* Today's task card with its progress. */}
      <span className="mt-1 flex flex-col gap-1 rounded-base border border-line surface-card p-1">
        <span className={`${bar} w-2/3 bg-ink-muted`} />
        <span className="block h-1 w-full rounded-full bg-line">
          <span className="block h-full w-3/5 rounded-full bg-accent" />
        </span>
        <PrimaryButton />
      </span>
    </span>
  );
}

function PracticeMock() {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {/* The video, then the sentence card with its answer box. */}
      <span className="flex aspect-video w-full items-center justify-center rounded-base bg-ink">
        <span className="block size-2 rounded-full bg-ground" />
      </span>
      <span className="flex flex-col gap-1 rounded-base border border-line surface-card p-1">
        <span className="block h-2 w-full rounded-base border border-line bg-surface" />
        <span className="flex gap-1">
          <span className={`${bar} w-1/3 bg-success`} />
          <span className={`${bar} w-1/4 bg-error`} />
          <span className={`${bar} w-1/5 bg-accent-ink`} />
        </span>
        <PrimaryButton />
      </span>
    </span>
  );
}
