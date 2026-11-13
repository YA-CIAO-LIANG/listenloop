/**
 * GitHub Actions minutes this month (D163), for the private repo's free
 * 2,000 minutes: every workflow run since the 1st (UTC), each rounded up
 * to whole minutes per job the way GitHub bills Linux runners. Read-only;
 * uses the `gh` login. `npm run actions:usage` (add `-- 2026-11` for
 * another month).
 */
import { execFileSync } from "node:child_process";

const REPO = "YA-CIAO-LIANG/listenloop";
const FREE_MINUTES = 2000;

const month = process.argv[2] ?? new Date().toISOString().slice(0, 7);
const start = `${month}-01`;
const next = new Date(`${start}T00:00:00Z`);
next.setUTCMonth(next.getUTCMonth() + 1);

function gh<T>(path: string): T {
  return JSON.parse(
    execFileSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 1e8 }),
  ) as T;
}

type Run = { id: number; name: string; event: string; created_at: string };
type Job = { started_at: string | null; completed_at: string | null };

const runs: Run[] = [];
for (let page = 1; ; page++) {
  const { workflow_runs } = gh<{ workflow_runs: Run[] }>(
    `repos/${REPO}/actions/runs?per_page=100&page=${page}&created=${start}..${next.toISOString().slice(0, 10)}`,
  );
  runs.push(...workflow_runs);
  if (workflow_runs.length < 100) break;
}

const byWorkflow = new Map<string, { runs: number; minutes: number }>();
for (const run of runs) {
  const { jobs } = gh<{ jobs: Job[] }>(
    `repos/${REPO}/actions/runs/${run.id}/jobs?per_page=100`,
  );
  const minutes = jobs.reduce((sum, job) => {
    if (!job.started_at || !job.completed_at) return sum;
    const ms = Date.parse(job.completed_at) - Date.parse(job.started_at);
    return ms > 0 ? sum + Math.ceil(ms / 60_000) : sum;
  }, 0);
  const key = `${run.name} (${run.event})`;
  const row = byWorkflow.get(key) ?? { runs: 0, minutes: 0 };
  byWorkflow.set(key, { runs: row.runs + 1, minutes: row.minutes + minutes });
}

const total = [...byWorkflow.values()].reduce((s, r) => s + r.minutes, 0);
const now = new Date();
const daysSoFar = Math.max(
  1,
  Math.min(
    (Math.min(now.getTime(), next.getTime()) -
      Date.parse(`${start}T00:00:00Z`)) /
      86_400_000,
    31,
  ),
);
const daysInMonth =
  (next.getTime() - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
console.log(`GitHub Actions, ${month} (estimate from job times)`);
for (const [name, row] of [...byWorkflow].sort(
  (a, b) => b[1].minutes - a[1].minutes,
)) {
  console.log(
    `  ${String(row.minutes).padStart(5)} min  ${String(row.runs).padStart(4)} runs  ${name}`,
  );
}
const projected = Math.round((total / daysSoFar) * daysInMonth);
console.log(
  `  total ${total} min so far; about ${projected} min at this pace (free: ${FREE_MINUTES})`,
);
if (projected > FREE_MINUTES * 0.8) {
  console.log(
    "  Over 80% of the free minutes: see docs/github-private.md (CI_LITE, fewer pull requests).",
  );
}
