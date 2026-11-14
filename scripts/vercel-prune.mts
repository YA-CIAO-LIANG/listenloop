/**
 * Deletes old Vercel deployments (D175), so their functions stop counting
 * towards the Hobby plan's 10 GB "Functions Storage".
 *
 * Keeps the deployment production points at and the N newest other
 * ready production deployments (default 3, so Instant Rollback still has
 * somewhere to go, docs/deploy-rollback.md); deletes every preview and
 * every older production deployment. Deployments still building are
 * never deleted.
 *
 *   npm run vercel:prune                 # dry run: lists what would go
 *   npm run vercel:prune -- --keep 5     # keep 5 previous production
 *   npm run vercel:prune -- --yes        # really delete
 *
 * Token: VERCEL_API_TOKEN, else the Vercel CLI's login (`vercel login`).
 * Project and team: VERCEL_PROJECT_ID / VERCEL_TEAM_ID, else
 * .vercel/project.json (`vercel link`). Deleting can't be undone.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
  deploymentsToPrune,
  listDeployments,
  vercelUrl,
  type VercelAccess,
  type VercelDeployment,
} from "../lib/ops/vercel-storage.ts";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const keepArg = args.indexOf("--keep");
const keep = keepArg >= 0 ? Number(args[keepArg + 1]) : 3;
if (!Number.isInteger(keep) || keep < 0) {
  console.error("--keep needs a whole number (0 or more).");
  process.exit(1);
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Where the Vercel CLI keeps its login on this machine. */
function cliAuthFile(): string {
  if (platform() === "darwin") {
    return join(
      homedir(),
      "Library/Application Support/com.vercel.cli/auth.json",
    );
  }
  if (platform() === "win32") {
    return join(
      process.env.APPDATA ?? join(homedir(), "AppData/Roaming"),
      "com.vercel.cli/Data/auth.json",
    );
  }
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local/share"),
    "com.vercel.cli/auth.json",
  );
}

function access(): VercelAccess {
  const token =
    process.env.VERCEL_API_TOKEN?.trim() ||
    (readJson(cliAuthFile())?.token as string | undefined);
  const linked = existsSync(".vercel/project.json")
    ? readJson(".vercel/project.json")
    : null;
  const projectId =
    process.env.VERCEL_PROJECT_ID?.trim() ||
    (linked?.projectId as string | undefined);
  const teamId =
    process.env.VERCEL_TEAM_ID?.trim() ||
    (linked?.orgId as string | undefined) ||
    null;
  if (!token) {
    console.error(
      "No Vercel token: set VERCEL_API_TOKEN or run `vercel login`.",
    );
    process.exit(1);
  }
  if (!projectId) {
    console.error(
      "No project: set VERCEL_PROJECT_ID or run `vercel link` in this folder.",
    );
    process.exit(1);
  }
  // A personal account's id starts with "user_"; it isn't a team.
  return {
    token,
    projectId,
    teamId: teamId?.startsWith("team_") ? teamId : null,
  };
}

async function api(
  a: VercelAccess,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(vercelUrl(path, a), {
    ...init,
    headers: { Authorization: `Bearer ${a.token}` },
  });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

/** The deployment production currently points at (after a rollback too). */
async function currentProduction(a: VercelAccess): Promise<string | null> {
  const project = (await api(
    a,
    `/v9/projects/${encodeURIComponent(a.projectId)}`,
  )) as { targets?: { production?: { id?: string } } };
  return project.targets?.production?.id ?? null;
}

const describe = (d: VercelDeployment) =>
  [
    d.uid,
    new Date(d.created).toISOString().slice(0, 16).replace("T", " "),
    (d.target ?? "preview").padEnd(10),
    (d.state ?? "").padEnd(8),
    d.url ?? "",
  ].join("  ");

const a = access();
const [deployments, currentId] = await Promise.all([
  listDeployments(a),
  currentProduction(a),
]);
if (!currentId) {
  console.warn(
    "Couldn't tell which deployment is production; keeping the newest ready production deployment.",
  );
}
const plan = deploymentsToPrune(deployments, { currentId, keep });

console.log(
  `${deployments.length} deployments. Keeping ${plan.keep.length} (production + ${keep} previous production):`,
);
for (const d of plan.keep) {
  console.log(
    `  keep    ${describe(d)}${d.uid === currentId ? "  ← production" : ""}`,
  );
}
console.log(`\n${yes ? "Deleting" : "Would delete"} ${plan.remove.length}:`);
for (const d of plan.remove) console.log(`  delete  ${describe(d)}`);

if (!yes) {
  console.log("\nDry run: nothing deleted. Add --yes to delete them.");
  process.exit(0);
}

let failed = 0;
for (const d of plan.remove) {
  try {
    await api(a, `/v13/deployments/${encodeURIComponent(d.uid)}`, {
      method: "DELETE",
    });
    console.log(`  deleted ${d.uid}`);
  } catch (error) {
    failed += 1;
    console.error(`  failed  ${d.uid}: ${(error as Error).message}`);
  }
}
console.log(
  `\nDeleted ${plan.remove.length - failed} of ${plan.remove.length}. Vercel's dashboard may take a while to show the lower Functions Storage.`,
);
process.exit(failed > 0 ? 1 : 0);
