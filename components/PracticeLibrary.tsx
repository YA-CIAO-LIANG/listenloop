"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LENGTH_BUCKETS,
  lengthBucket,
  minutesAndSeconds,
  parseLengthFilter,
  type LengthBucketId,
} from "@/lib/excerpt-length";
import type { VideoCategory, VideoCollection, VideoLevel } from "@/lib/videos";
import { Button } from "./Button";
import { CardLink } from "./CardLink";
import { VideoProgressLabel } from "./VideoProgressLabel";

/** What a library card needs (built on the server, so no video data ships twice). */
export type VideoSummary = {
  id: string;
  title: string;
  level: VideoLevel;
  category: VideoCategory;
  source: string;
  sentenceCount: number;
  /** excerptSeconds: first start to last end. */
  seconds: number;
};

export type LibraryGroup = {
  collection: VideoCollection;
  videos: VideoSummary[];
};

/** The URL parameter holding the length filter (?length=1-2,8-plus). */
export const LENGTH_PARAM = "length";

type LibraryViewProps = {
  groups: readonly LibraryGroup[];
  selected: readonly LengthBucketId[];
  onToggle: (id: LengthBucketId) => void;
  onClear: () => void;
};

/**
 * The practice library: length filter buttons (several can be on; a video
 * shows when it falls in any of them), then one section per collection with
 * the matching cards. Collections with no match are hidden; with no match
 * at all, a note and a button to clear the filter.
 */
export function LibraryView({
  groups,
  selected,
  onToggle,
  onClear,
}: LibraryViewProps) {
  const t = useTranslations("library");
  const tLength = useTranslations("library.length");
  const tAll = useTranslations();

  const all = groups.flatMap((group) => group.videos);
  const counts = new Map<LengthBucketId, number>();
  for (const video of all) {
    const bucket = lengthBucket(video.seconds);
    if (bucket) counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const matches = (video: VideoSummary) => {
    const bucket = lengthBucket(video.seconds);
    return (
      selected.length === 0 || (bucket !== null && selected.includes(bucket))
    );
  };
  const shown = groups
    .map((group) => ({ ...group, videos: group.videos.filter(matches) }))
    .filter((group) => group.videos.length > 0);
  const shownCount = shown.reduce((sum, group) => sum + group.videos.length, 0);

  return (
    <>
      <div
        role="group"
        aria-labelledby="length-filter-label"
        className="mt-8 flex flex-wrap items-center gap-2"
      >
        <span
          id="length-filter-label"
          className="mr-2 text-metadata tracking-widest text-ink-muted uppercase"
        >
          {tLength("label")}
        </span>
        {LENGTH_BUCKETS.map(({ id }) => {
          const on = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(id)}
              className={`inline-flex h-8 items-center rounded-base border px-3 text-supporting tabular-nums transition-colors duration-(--ll-duration-transition) pointer-coarse:min-h-11 ${
                on
                  ? "border-ink bg-ink text-ground"
                  : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
              }`}
            >
              {on && <span aria-hidden="true">✓ </span>}
              {tLength("option", {
                bucket: tLength(`buckets.${id}`),
                count: counts.get(id) ?? 0,
              })}
            </button>
          );
        })}
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {tLength("clear")}
          </Button>
        )}
      </div>
      <p aria-live="polite" className="mt-3 text-supporting text-ink-muted">
        {selected.length > 0 && tLength("results", { count: shownCount })}
      </p>

      {shown.length === 0 ? (
        <div className="mt-8 space-y-4">
          <p className="text-ink-muted">{tLength("empty")}</p>
          <Button variant="secondary" onClick={onClear}>
            {tLength("clearAll")}
          </Button>
        </div>
      ) : (
        shown.map(({ collection, videos }) => (
          <section
            key={collection}
            aria-labelledby={`collection-${collection}`}
            className="mt-12 first-of-type:mt-8"
          >
            <h3
              id={`collection-${collection}`}
              className="flex flex-wrap items-baseline gap-x-3 font-display text-h3"
            >
              {tAll(`collections.${collection}.title`)}
              <span className="text-supporting font-normal text-ink-muted">
                {t("videoCount", { count: videos.length })}
              </span>
            </h3>
            <p className="mt-1 text-supporting text-ink-muted">
              {tAll(`collections.${collection}.intro`)}
            </p>
            <ul className="mt-6 grid gap-6 split:grid-cols-2">
              {videos.map((video) => (
                <li key={video.id}>
                  <CardLink href={`/videos/${video.id}`}>
                    <p className="text-metadata tracking-widest text-ink-muted uppercase">
                      {tAll(`video.levels.${video.level}`)} ·{" "}
                      {tAll(`video.categories.${video.category}`)}
                    </p>
                    <p lang="en" className="mt-4 font-display text-h3">
                      {video.title}
                    </p>
                    <VideoProgressLabel videoId={video.id} />
                    <p className="mt-4 flex justify-between gap-4 text-supporting text-ink-muted">
                      <span>
                        {video.source} ·{" "}
                        {t("sentences", { count: video.sentenceCount })} ·{" "}
                        {t("excerptLength", minutesAndSeconds(video.seconds))}
                      </span>
                      <span aria-hidden="true">→</span>
                    </p>
                  </CardLink>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

/**
 * The whole library with no filter on: the <Suspense> fallback while the
 * URL is read (server render). Lives here because a Server Component can't
 * pass the event handlers LibraryView needs.
 */
export function UnfilteredLibrary({
  groups,
}: {
  groups: readonly LibraryGroup[];
}) {
  return (
    <LibraryView
      groups={groups}
      selected={[]}
      onToggle={() => {}}
      onClear={() => {}}
    />
  );
}

/**
 * LibraryView with the length filter kept in the URL (?length=…), so a
 * reload or a shared link keeps it. Changing it replaces the URL without
 * scrolling or adding history. Render inside <Suspense> (useSearchParams);
 * the fallback is the unfiltered LibraryView.
 */
export function PracticeLibrary({
  groups,
}: {
  groups: readonly LibraryGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = parseLengthFilter(searchParams.get(LENGTH_PARAM));

  function show(next: readonly LengthBucketId[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) params.set(LENGTH_PARAM, next.join(","));
    else params.delete(LENGTH_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <LibraryView
      groups={groups}
      selected={selected}
      onToggle={(id) =>
        show(
          selected.includes(id)
            ? selected.filter((s) => s !== id)
            : LENGTH_BUCKETS.map((b) => b.id).filter(
                (b) => b === id || selected.includes(b),
              ),
        )
      }
      onClear={() => show([])}
    />
  );
}
