/**
 * Groups a QA sweep round's findings (qa-results/round-N/findings.jsonl):
 * one line per kind, page, and detail, with the combinations it happened
 * in. `QA_ROUND=1 npm run qa:summary`.
 */
import { readFileSync } from "node:fs";

type Row = {
  page: string;
  role: string;
  kind: string;
  detail: string;
  width?: number;
  scheme?: string;
  locale?: string;
};

const round = process.env.QA_ROUND ?? "1";
const rows: Row[] = readFileSync(
  `qa-results/round-${round}/findings.jsonl`,
  "utf8",
)
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const groups = new Map<string, Row[]>();
for (const row of rows) {
  const key = `${row.kind}\t${row.role} ${row.page}\t${row.detail}`;
  groups.set(key, [...(groups.get(key) ?? []), row]);
}
const byKind = new Map<string, number>();
for (const key of groups.keys()) {
  const kind = key.split("\t")[0];
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
}
console.log(`Round ${round}: ${rows.length} findings, ${groups.size} distinct`);
console.log([...byKind].map(([k, n]) => `${k} ${n}`).join(", "));
for (const [key, list] of [...groups].sort()) {
  const widths = [...new Set(list.map((r) => r.width).filter(Boolean))].join(
    ",",
  );
  const schemes = [...new Set(list.map((r) => r.scheme).filter(Boolean))].join(
    ",",
  );
  const locales = [...new Set(list.map((r) => r.locale).filter(Boolean))].join(
    ",",
  );
  console.log(`${key}\t[${widths} ${schemes} ${locales}]`);
}
