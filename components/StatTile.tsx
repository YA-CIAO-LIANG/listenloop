import type { ReactNode } from "react";

/**
 * One number on an admin page (D38, D56): a metadata label, the number in
 * Display h2, and a supporting note. Used inside a <dl>.
 */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded border border-line bg-surface p-4">
      <dt className="text-metadata tracking-widest text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="mt-2 font-display text-h2 tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-supporting text-ink-muted">{note}</dd>}
    </div>
  );
}
