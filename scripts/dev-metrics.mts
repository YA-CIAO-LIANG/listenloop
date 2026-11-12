/**
 * Development speed per milestone (D151), for docs/ai-dev-log.md:
 *
 *   npm run dev:metrics
 *
 * Reads the merged pull requests from GitHub (gh, read-only) and the
 * milestone table in docs/ai-dev-log.md (its "主要 PR" column), and
 * prints, per milestone:
 * - PRs, and commits per PR (how many times each was revised);
 * - each PR's cycle: from the previous merge to its own. Work is done
 *   one item at a time, and a PR is opened only when its work is done,
 *   so this is the real time per item (first commit to merge is minutes);
 * - open to merge: CI and merging;
 * - the milestone's span: from the merge before its first PR to its last.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { median, milestonesFrom } from "../lib/dev-metrics.ts";

type Pr = {
  number: number;
  createdAt: string;
  mergedAt: string;
  commits: number;
  firstCommitAt: string;
};

const QUERY = `query($endCursor: String) {
  repository(owner: "YA-CIAO-LIANG", name: "listenloop") {
    pullRequests(first: 100, states: MERGED, after: $endCursor) {
      nodes {
        number
        createdAt
        mergedAt
        commits(first: 1) { totalCount nodes { commit { authoredDate } } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

function mergedPrs(): Map<number, Pr> {
  const out = execFileSync(
    "gh",
    [
      "api",
      "graphql",
      "--paginate",
      "-f",
      `query=${QUERY}`,
      "-q",
      ".data.repository.pullRequests.nodes[] | [.number, .createdAt, .mergedAt, .commits.totalCount, .commits.nodes[0].commit.authoredDate] | @tsv",
    ],
    { encoding: "utf8" },
  );
  const prs = new Map<number, Pr>();
  for (const line of out.trim().split("\n")) {
    const [number, createdAt, mergedAt, commits, firstCommitAt] =
      line.split("\t");
    prs.set(Number(number), {
      number: Number(number),
      createdAt,
      mergedAt,
      commits: Number(commits),
      firstCommitAt,
    });
  }
  return prs;
}

/** The milestone table: name and PR numbers, in order. */
const milestones = () =>
  milestonesFrom(readFileSync("docs/ai-dev-log.md", "utf8"));

const minutes = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const fixed = (n: number, digits = 1) =>
  Number.isFinite(n) ? n.toFixed(digits) : "—";

const prs = mergedPrs();
const byMerge = [...prs.values()].sort((a, b) =>
  a.mergedAt.localeCompare(b.mergedAt),
);
/** When the merge before each PR happened (its cycle's start). */
const previousMerge = new Map<number, string>();
byMerge.forEach((pr, i) => {
  if (i > 0) previousMerge.set(pr.number, byMerge[i - 1].mergedAt);
});
/** A cycle over 8 hours spans a night or a wait for Joe: left out. */
const WORKING_CYCLE_MINUTES = 8 * 60;
const cycles = (list: Pr[]) =>
  list
    .flatMap((pr) => {
      const from = previousMerge.get(pr.number);
      return from ? [minutes(from, pr.mergedAt)] : [];
    })
    .filter((m) => m <= WORKING_CYCLE_MINUTES);

const rows = milestones().flatMap((milestone) => {
  const found = milestone.prs.flatMap((n) => prs.get(n) ?? []);
  // A milestone whose PRs aren't merged yet has nothing to show.
  if (found.length === 0) return [];
  const first = [...found].sort((a, b) =>
    a.mergedAt.localeCompare(b.mergedAt),
  )[0];
  const last = found.reduce((a, b) => (a.mergedAt > b.mergedAt ? a : b));
  const spanFrom = previousMerge.get(first.number) ?? first.firstCommitAt;
  return [
    {
      name: milestone.name,
      prs: found.length,
      commits: mean(found.map((pr) => pr.commits)),
      cycle: median(cycles(found)),
      review: median(found.map((pr) => minutes(pr.createdAt, pr.mergedAt))),
      span: minutes(spanFrom, last.mergedAt) / 60,
    },
  ];
});

console.log(
  "| 里程碑 | PR 數 | 每個 PR 的 commit 數（平均） | 每項週期（中位數，分鐘） | 開 PR 到合併（中位數，分鐘） | 整批耗時（小時） |",
);
console.log("| --- | --- | --- | --- | --- | --- |");
for (const row of rows) {
  console.log(
    `| ${row.name} | ${row.prs} | ${fixed(row.commits)} | ${fixed(row.cycle, 0)} | ${fixed(row.review, 0)} | ${fixed(row.span)} |`,
  );
}
const all = [...prs.values()];
console.log(
  `| **全部** | ${all.length} | ${fixed(mean(all.map((p) => p.commits)))} | ${fixed(median(cycles(all)), 0)} | ${fixed(median(all.map((p) => minutes(p.createdAt, p.mergedAt))), 0)} | — |`,
);
