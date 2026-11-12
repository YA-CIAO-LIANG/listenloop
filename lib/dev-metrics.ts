/**
 * Parsing for `npm run dev:metrics` (D151): the milestone table in
 * docs/ai-dev-log.md and its PR numbers.
 */

/** "#87、#88、#90～#92" → [87, 88, 90, 91, 92]. */
export function prNumbers(cell: string): number[] {
  return cell.split(/[、,]/).flatMap((part) => {
    const range = /#(\d+)\s*[～~-]\s*#(\d+)/.exec(part);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    }
    const one = /#(\d+)/.exec(part);
    return one ? [Number(one[1])] : [];
  });
}

/** The "## 里程碑" table: each milestone's name and PR numbers, in order. */
export function milestonesFrom(log: string): { name: string; prs: number[] }[] {
  const table = log.split("\n## 里程碑")[1]?.split("\n## ")[0] ?? "";
  return table
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| 里程碑"))
    .filter((line) => !/^\|\s*-+/.test(line))
    .map((line) => {
      const cells = line.split("|").map((c) => c.trim());
      return { name: cells[1], prs: prNumbers(cells[3] ?? "") };
    })
    .filter((m) => m.prs.length > 0);
}

/** The middle value (NaN for none). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
