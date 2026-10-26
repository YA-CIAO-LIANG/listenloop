"use client";

import { Fragment, useId } from "react";

type Option<V extends string> = { value: V; label: string; lang?: string };

type SegmentedControlProps<V extends string> = {
  /** Accessible group name, read by screen readers. */
  legend: string;
  value: V;
  options: readonly Option<V>[];
  onChange: (value: V) => void;
  busy?: boolean;
  /**
   * Min width per option, wide enough for the longest label in every UI
   * language so switching languages doesn't shift the layout.
   */
  optionWidthClassName: string;
};

/**
 * Inline "A / B / C" choice built on native radio inputs, so arrow keys and
 * screen-reader semantics come from the browser. The selected option uses
 * accent-ink plus an underline (not color alone).
 */
export function SegmentedControl<V extends string>({
  legend,
  value,
  options,
  onChange,
  busy = false,
  optionWidthClassName,
}: SegmentedControlProps<V>) {
  // Unique per instance: radios sharing a name form one group across the
  // page, so two toggles (header + settings) would steal each other's arrows.
  const name = useId();

  return (
    <fieldset className="flex items-center" aria-busy={busy || undefined}>
      <legend className="sr-only">{legend}</legend>
      {options.map((option, index) => (
        <Fragment key={option.value}>
          {index > 0 && (
            <span aria-hidden="true" className="text-supporting text-line">
              /
            </span>
          )}
          <label className="flex cursor-pointer items-center pointer-coarse:min-h-11">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              lang={option.lang}
              className={`${optionWidthClassName} rounded-base px-2 py-1 text-center text-supporting text-ink-muted decoration-1 underline-offset-4 transition-colors duration-(--ll-duration-transition) peer-checked:text-accent-ink peer-checked:underline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-focus-visible:outline-solid hover:text-ink`}
            >
              {option.label}
            </span>
          </label>
        </Fragment>
      ))}
    </fieldset>
  );
}
