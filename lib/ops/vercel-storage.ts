/**
 * Vercel "Functions Storage" (D175): on the Hobby plan every deployment
 * that still exists keeps its server functions, and together they may
 * use 10 GB. Vercel has no usage API for Hobby, so we add it up from the
 * REST API: list the project's deployments, then each deployment's
 * build outputs, and sum the unique functions ("lambda" outputs, the same
 * function shared by several routes has one digest).
 *
 * The parsing and the sum are pure (tested with a fixture); the
 * collection takes its fetch, so tests never reach api.vercel.com.
 */

export const VERCEL_API = "https://api.vercel.com";

/** One deployment's functions: unique bytes and how many. */
export type DeploymentFunctions = { bytes: number; lambdas: number };

/**
 * Sums one deployment's unique functions from the response of
 * GET /v11/deployments/{id}/builds: `builds[].output[]` where
 * `type === "lambda"`, deduplicated by `digest` (by `path` when a
 * digest is missing). Anything not shaped like that counts as 0.
 */
export function deploymentFunctionBytes(
  response: unknown,
): DeploymentFunctions {
  const builds = (response as { builds?: unknown } | null)?.builds;
  if (!Array.isArray(builds)) return { bytes: 0, lambdas: 0 };
  const seen = new Map<string, number>();
  for (const build of builds) {
    const output = (build as { output?: unknown } | null)?.output;
    if (!Array.isArray(output)) continue;
    for (const item of output) {
      const o = item as {
        type?: unknown;
        digest?: unknown;
        path?: unknown;
        size?: unknown;
      } | null;
      if (o?.type !== "lambda") continue;
      const size = typeof o.size === "number" && o.size > 0 ? o.size : 0;
      const key =
        typeof o.digest === "string" && o.digest
          ? `d:${o.digest}`
          : `p:${String(o.path)}`;
      if (!seen.has(key)) seen.set(key, size);
    }
  }
  let bytes = 0;
  for (const size of seen.values()) bytes += size;
  return { bytes, lambdas: seen.size };
}

export type VercelDeployment = {
  uid: string;
  /** "production", or null for a preview. */
  target: string | null;
  /** Milliseconds since the epoch. */
  created: number;
  state: string | null;
  url: string | null;
};

/** The deployments in one page of GET /v6/deployments. */
export function parseDeployments(response: unknown): {
  deployments: VercelDeployment[];
  /** Pass as `until` for the next (older) page; null on the last page. */
  next: number | null;
} {
  const r = response as {
    deployments?: unknown;
    pagination?: { next?: unknown } | null;
  } | null;
  const deployments = Array.isArray(r?.deployments)
    ? r.deployments.flatMap((raw): VercelDeployment[] => {
        const d = raw as Record<string, unknown> | null;
        if (!d || typeof d.uid !== "string") return [];
        const created = Number(d.created ?? d.createdAt ?? 0) || 0;
        return [
          {
            uid: d.uid,
            target: typeof d.target === "string" ? d.target : null,
            created,
            state:
              typeof d.state === "string"
                ? d.state
                : typeof d.readyState === "string"
                  ? d.readyState
                  : null,
            url: typeof d.url === "string" ? d.url : null,
          },
        ];
      })
    : [];
  const next = Number(r?.pagination?.next);
  return { deployments, next: Number.isFinite(next) && next > 0 ? next : null };
}

export type FunctionsStorage = {
  /** Sum of every deployment's unique functions, bytes. */
  bytes: number;
  deployments: number;
  /** The largest deployments first, for the admin page. */
  largest: { uid: string; target: string | null; bytes: number }[];
};

/** Adds up the deployments' functions. */
export function sumFunctionsStorage(
  items: { deployment: VercelDeployment; functions: DeploymentFunctions }[],
): FunctionsStorage {
  return {
    bytes: items.reduce((total, item) => total + item.functions.bytes, 0),
    deployments: items.length,
    largest: items
      .map((item) => ({
        uid: item.deployment.uid,
        target: item.deployment.target,
        bytes: item.functions.bytes,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5),
  };
}

export type VercelAccess = {
  token: string;
  teamId: string | null;
  projectId: string;
};

/**
 * The token, team, and project from the environment (VERCEL_API_TOKEN,
 * VERCEL_TEAM_ID, VERCEL_PROJECT_ID); null when the token or the project
 * is missing. A personal account has no team: VERCEL_TEAM_ID may be empty.
 */
export function vercelAccess(
  env: Record<string, string | undefined> = process.env,
): VercelAccess | null {
  const token = env.VERCEL_API_TOKEN?.trim();
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID?.trim() || null };
}

/** An API URL with the team added when there is one. */
export function vercelUrl(
  path: string,
  access: Pick<VercelAccess, "teamId">,
  params: Record<string, string | number> = {},
): string {
  const url = new URL(path, VERCEL_API);
  if (access.teamId) url.searchParams.set("teamId", access.teamId);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

type Fetch = typeof fetch;

async function getJson(
  fetchImpl: Fetch,
  url: string,
  token: string,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Vercel API ${response.status}`);
  }
  return response.json();
}

/** Every deployment of the project, newest first (all pages). */
export async function listDeployments(
  access: VercelAccess,
  fetchImpl: Fetch = fetch,
  { maxPages = 20 }: { maxPages?: number } = {},
): Promise<VercelDeployment[]> {
  const all: VercelDeployment[] = [];
  let until: number | null = null;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string | number> = {
      projectId: access.projectId,
      limit: 100,
    };
    if (until) params.until = until;
    const { deployments, next } = parseDeployments(
      await getJson(
        fetchImpl,
        vercelUrl("/v6/deployments", access, params),
        access.token,
      ),
    );
    all.push(...deployments);
    if (!next || deployments.length === 0) break;
    until = next;
  }
  return all.sort((a, b) => b.created - a.created);
}

/** One deployment's functions, from its build outputs. */
export async function fetchDeploymentFunctions(
  access: VercelAccess,
  uid: string,
  fetchImpl: Fetch = fetch,
): Promise<DeploymentFunctions> {
  return deploymentFunctionBytes(
    await getJson(
      fetchImpl,
      vercelUrl(`/v11/deployments/${encodeURIComponent(uid)}/builds`, access),
      access.token,
    ),
  );
}

/** The project's Functions Storage, a few deployments at a time. */
export async function collectFunctionsStorage(
  access: VercelAccess,
  fetchImpl: Fetch = fetch,
): Promise<FunctionsStorage> {
  const deployments = await listDeployments(access, fetchImpl);
  const items: {
    deployment: VercelDeployment;
    functions: DeploymentFunctions;
  }[] = [];
  const BATCH = 5;
  for (let i = 0; i < deployments.length; i += BATCH) {
    const batch = deployments.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((deployment) =>
        fetchDeploymentFunctions(access, deployment.uid, fetchImpl),
      ),
    );
    batch.forEach((deployment, j) =>
      items.push({ deployment, functions: results[j] }),
    );
  }
  return sumFunctionsStorage(items);
}

const FINISHED = new Set(["READY", "ERROR", "CANCELED"]);

/**
 * Which deployments `npm run vercel:prune` deletes (D175): keeps the one
 * production points at and the `keep` newest other production
 * deployments (so Instant Rollback still has somewhere to go), and
 * deletes every preview and older production deployment. Newest first.
 */
export function deploymentsToPrune(
  deployments: VercelDeployment[],
  { currentId, keep }: { currentId: string | null; keep: number },
): { keep: VercelDeployment[]; remove: VercelDeployment[] } {
  const sorted = [...deployments].sort((a, b) => b.created - a.created);
  const kept = new Set<string>();
  if (currentId) kept.add(currentId);
  let recent = 0;
  for (const d of sorted) {
    if (d.target !== "production" || d.uid === currentId) continue;
    // A failed build can't be rolled back to; don't let it take a slot.
    if (d.state && d.state !== "READY") continue;
    if (recent >= keep) break;
    kept.add(d.uid);
    recent += 1;
  }
  // Without a known current deployment, keep the newest ready production.
  if (!currentId) {
    const newest = sorted.find(
      (d) => d.target === "production" && (!d.state || d.state === "READY"),
    );
    if (newest) kept.add(newest.uid);
  }
  // Never delete a deployment that is still building.
  for (const d of sorted) {
    if (d.state && !FINISHED.has(d.state)) kept.add(d.uid);
  }
  return {
    keep: sorted.filter((d) => kept.has(d.uid)),
    remove: sorted.filter((d) => !kept.has(d.uid)),
  };
}
