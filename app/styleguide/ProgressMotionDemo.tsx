"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";

// Prototype for choosing a progress animation (A/B/C). Once Joe picks one,
// it moves into components/ProgressBar.tsx and this file is deleted.

const TOTAL = 12;
const VARIANTS = ["a", "b", "c"] as const;
type Variant = (typeof VARIANTS)[number];

export function ProgressMotionDemo() {
  const t = useTranslations("styleguide.progressMotion");
  return (
    <div className="space-y-6">
      <p className="max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="grid gap-8 split:grid-cols-3">
        {VARIANTS.map((variant) => (
          <OptionDemo key={variant} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function OptionDemo({ variant }: { variant: Variant }) {
  const t = useTranslations("styleguide.progressMotion");
  const tDictation = useTranslations("dictation");
  const [value, setValue] = useState(2);
  const done = value >= TOTAL;
  const n = Math.min(value + 1, TOTAL);
  const label = tDictation("position", { n, total: TOTAL });

  return (
    <section className="space-y-4 rounded-base border border-line p-6">
      <div>
        <h3 className="font-display text-h3">{t(`options.${variant}.name`)}</h3>
        <p className="mt-1 text-supporting text-ink-muted">
          {t(`options.${variant}.description`)}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={TOTAL}
        aria-valuenow={value}
        data-variant={variant}
        data-done={done || undefined}
      >
        {variant === "c" ? (
          <CounterLabel label={label} n={n} done={done} />
        ) : (
          <p className="mb-2 text-metadata tracking-widest text-ink-muted uppercase">
            {label}
          </p>
        )}
        {variant === "a" && <LeadingDotBar value={value} done={done} />}
        {variant === "b" && <SegmentFillBar value={value} done={done} />}
        {variant === "c" && <Segments value={value} />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={done}
          onClick={() => setValue((v) => Math.min(v + 1, TOTAL))}
        >
          {t("add")}
        </Button>
        <Button size="sm" disabled={done} onClick={() => setValue(TOTAL)}>
          {t("complete")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setValue(0)}>
          {t("reset")}
        </Button>
      </div>
    </section>
  );
}

/** Plain segmented track, as in ProgressBar today. */
function Segments({ value }: { value: number }) {
  return (
    <div className="flex h-1 gap-0.5">
      {Array.from({ length: TOTAL }, (_, index) => (
        <span
          key={index}
          className={`flex-1 transition-colors duration-(--ll-duration-progress) motion-reduce:transition-none ${
            index < value ? "bg-accent" : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}

/** A. A dot rides the front edge, hops per sentence, pops with a halo at the end. */
function LeadingDotBar({ value, done }: { value: number; done: boolean }) {
  const left = `${(value / TOTAL) * 100}%`;
  return (
    <div className="relative">
      <Segments value={value} />
      {/* key restarts the hop each time the value changes. */}
      <span
        key={done ? "done" : value}
        aria-hidden="true"
        className={`absolute top-1/2 size-1.5 bg-accent transition-[left] duration-(--ll-duration-progress) motion-reduce:animate-none motion-reduce:transition-none ${
          done ? "animate-dot-pop" : "animate-dot-hop"
        }`}
        style={{
          left,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
        }}
      />
      {done && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-1.5 animate-dot-halo border border-accent motion-reduce:hidden"
          style={{ left: "100%", borderRadius: "50%" }}
        />
      )}
    </div>
  );
}

/** B. The newest segment grows up; all segments glint left to right at the end. */
function SegmentFillBar({ value, done }: { value: number; done: boolean }) {
  return (
    <div className="flex h-1 gap-0.5">
      {Array.from({ length: TOTAL }, (_, index) => {
        const filled = index < value;
        const isNewest = index === value - 1;
        const animation = done
          ? "animate-segment-glint"
          : isNewest
            ? "animate-segment-grow"
            : "";
        return (
          <span
            // Remount the newest segment (or all at the end) to replay the animation.
            key={done ? `done-${index}` : isNewest ? `new-${value}` : index}
            className={`flex-1 origin-bottom motion-reduce:animate-none ${animation} ${
              filled ? "bg-accent" : "bg-line"
            }`}
            style={done ? { animationDelay: `${index * 40}ms` } : undefined}
          />
        );
      })}
    </div>
  );
}

/** C. The sentence number flips up; a check mark draws itself when done. */
function CounterLabel({
  label,
  n,
  done,
}: {
  label: string;
  n: number;
  done: boolean;
}) {
  // Split the translated label around the number so only the number moves.
  const [before, after] = label.split(String(n));
  return (
    <p
      aria-hidden="true"
      className="mb-2 flex items-center gap-2 text-metadata tracking-widest text-ink-muted uppercase"
    >
      <span>
        {before}
        <span className="inline-block overflow-hidden align-bottom">
          <span
            key={n}
            className="inline-block animate-count-flip motion-reduce:animate-none"
          >
            {n}
          </span>
        </span>
        {after}
      </span>
      {done && (
        <svg
          viewBox="0 0 16 16"
          className="size-3.5 text-success"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M3 8.5l3 3 7-7"
            strokeDasharray={24}
            className="animate-check-draw motion-reduce:animate-none"
          />
        </svg>
      )}
    </p>
  );
}
