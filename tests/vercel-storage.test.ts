import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFunctionsStorage,
  resetFunctionsStorageCache,
} from "@/auth/vercel-storage";
import {
  evaluateAlerts,
  vercelFunctionsAlert,
  type OpsSnapshot,
} from "@/lib/ops/alerts";
import { OPS_THRESHOLDS } from "@/lib/ops/thresholds";
import {
  collectFunctionsStorage,
  deploymentFunctionBytes,
  deploymentsToPrune,
  parseDeployments,
  vercelAccess,
  vercelUrl,
  type VercelDeployment,
} from "@/lib/ops/vercel-storage";

/** Vercel Functions Storage (D175): the sum, the alerts, and pruning. */

const builds = JSON.parse(
  readFileSync("tests/fixtures/vercel/builds.json", "utf8"),
) as unknown;

// The five unique functions measured on 2026-11-14.
const FIXTURE_BYTES = 21_080_000 + 11_360_000 + 11_280_000 + 920_000 + 400_000;

describe("deploymentFunctionBytes", () => {
  it("sums each function once (by digest), lambdas only", () => {
    expect(deploymentFunctionBytes(builds)).toEqual({
      bytes: FIXTURE_BYTES,
      lambdas: 5,
    });
  });

  it("falls back to the path when there is no digest", () => {
    expect(
      deploymentFunctionBytes({
        builds: [
          {
            output: [
              { type: "lambda", path: "a", size: 10 },
              { type: "lambda", path: "a", size: 10 },
              { type: "lambda", path: "b", size: 5 },
            ],
          },
        ],
      }),
    ).toEqual({ bytes: 15, lambdas: 2 });
  });

  it("treats anything else as nothing", () => {
    for (const bad of [null, {}, { builds: "x" }, { builds: [null, {}] }]) {
      expect(deploymentFunctionBytes(bad)).toEqual({ bytes: 0, lambdas: 0 });
    }
  });
});

describe("parseDeployments", () => {
  it("reads the deployments and the next page", () => {
    expect(
      parseDeployments({
        deployments: [
          {
            uid: "dpl_1",
            target: "production",
            created: 2,
            state: "READY",
            url: "a.vercel.app",
          },
          { uid: "dpl_2", target: null, createdAt: 1, readyState: "ERROR" },
          { nope: true },
        ],
        pagination: { next: 1 },
      }),
    ).toEqual({
      deployments: [
        {
          uid: "dpl_1",
          target: "production",
          created: 2,
          state: "READY",
          url: "a.vercel.app",
        },
        { uid: "dpl_2", target: null, created: 1, state: "ERROR", url: null },
      ],
      next: 1,
    });
    expect(parseDeployments({ deployments: [], pagination: {} }).next).toBe(
      null,
    );
  });
});

describe("vercelAccess and vercelUrl", () => {
  it("needs the token and the project; the team is optional", () => {
    expect(vercelAccess({})).toBeNull();
    expect(vercelAccess({ VERCEL_API_TOKEN: "t" })).toBeNull();
    expect(
      vercelAccess({ VERCEL_API_TOKEN: " t ", VERCEL_PROJECT_ID: "prj" }),
    ).toEqual({ token: "t", projectId: "prj", teamId: null });
    expect(
      vercelUrl("/v6/deployments", { teamId: "team_1" }, { limit: 100 }),
    ).toBe("https://api.vercel.com/v6/deployments?teamId=team_1&limit=100");
  });
});

/** A stub of the two Vercel endpoints, two pages of deployments. */
function stubVercel() {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    if (url.pathname === "/v6/deployments") {
      const page = url.searchParams.get("until")
        ? {
            deployments: [{ uid: "dpl_old", target: null, created: 1 }],
            pagination: { next: null },
          }
        : {
            deployments: [
              { uid: "dpl_new", target: "production", created: 3 },
              { uid: "dpl_mid", target: "production", created: 2 },
            ],
            pagination: { next: 2 },
          };
      return Response.json(page);
    }
    return Response.json(builds);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe("collectFunctionsStorage", () => {
  it("follows the pages and adds every deployment", async () => {
    const { fetchImpl, calls } = stubVercel();
    const result = await collectFunctionsStorage(
      { token: "t", teamId: "team_1", projectId: "prj" },
      fetchImpl,
    );
    expect(result.deployments).toBe(3);
    expect(result.bytes).toBe(3 * FIXTURE_BYTES);
    expect(calls.filter((c) => c.startsWith("/v6/"))).toHaveLength(2);
    expect(calls).toContain("/v11/deployments/dpl_old/builds?teamId=team_1");
  });
});

describe("getFunctionsStorage", () => {
  beforeEach(() => resetFunctionsStorageCache());
  const env = { VERCEL_API_TOKEN: "t", VERCEL_PROJECT_ID: "prj" };

  it("is unset without the token", async () => {
    expect(await getFunctionsStorage({ env: {} })).toEqual({
      status: "unset",
    });
  });

  it("asks Vercel at most once an hour", async () => {
    const { fetchImpl } = stubVercel();
    const now = new Date("2026-11-14T00:00:00Z");
    const first = await getFunctionsStorage({ env, fetchImpl, now });
    expect(first).toMatchObject({ status: "ok", deployments: 3 });
    const calls = vi.mocked(fetchImpl).mock.calls.length;
    await getFunctionsStorage({
      env,
      fetchImpl,
      now: new Date("2026-11-14T00:59:00Z"),
    });
    expect(vi.mocked(fetchImpl).mock.calls.length).toBe(calls);
    await getFunctionsStorage({
      env,
      fetchImpl,
      now: new Date("2026-11-14T01:01:00Z"),
    });
    expect(vi.mocked(fetchImpl).mock.calls.length).toBeGreaterThan(calls);
  });

  it("reports an error when the API refuses", async () => {
    const fetchImpl = (async () =>
      new Response("no", { status: 403 })) as typeof fetch;
    expect(await getFunctionsStorage({ env, fetchImpl })).toEqual({
      status: "error",
    });
  });
});

describe("Functions Storage alerts", () => {
  const cap = OPS_THRESHOLDS.vercelFunctionsStorageBytes;

  it("warns from 70% and is critical from 90%", () => {
    expect(vercelFunctionsAlert(null, cap)).toBeNull();
    expect(vercelFunctionsAlert(cap * 0.69, cap)).toBeNull();
    expect(vercelFunctionsAlert(cap * 0.7, cap)).toMatchObject({
      key: "vercel-functions:70",
      level: "warning",
    });
    expect(vercelFunctionsAlert(cap * 0.9, cap)).toMatchObject({
      key: "vercel-functions:90",
      level: "critical",
    });
    // The number measured on 2026-11-14: 10.57 GB of 10 GB.
    expect(vercelFunctionsAlert(10.57e9, cap)?.message).toContain(
      "10.57 GB / 10.00 GB（106%）",
    );
  });

  it("is part of evaluateAlerts when the daily run checked it", () => {
    const quiet: OpsSnapshot = {
      health: {
        db: "ok",
        storage: "ok",
        ai: "ok",
        speech: "ok",
        config: "ok",
      },
      errors15m: 0,
      errors7d: 0,
      todayMicros: 0,
      previousDaysMicros: [],
      monthMicros: 0,
      monthCapMicros: 8_000_000,
      speechCharsMonth: 0,
      speechCharsCap: 500_000,
      audioSecondsMonth: 0,
      audioSecondsCap: 16_200,
      databaseBytes: 0,
      databaseCap: 1,
      storageBytes: 0,
      storageCap: 1,
      signups1h: 0,
      reports1h: 0,
    };
    expect(evaluateAlerts(quiet)).toEqual([]);
    expect(
      evaluateAlerts({ ...quiet, vercelFunctionsBytes: 8e9 }).map((a) => a.key),
    ).toEqual(["vercel-functions:70"]);
    expect(
      evaluateAlerts({ ...quiet, vercelFunctionsBytes: 180e6 }).map(
        (a) => a.key,
      ),
    ).toEqual([]);
  });
});

describe("deploymentsToPrune", () => {
  const d = (
    uid: string,
    created: number,
    target: string | null = "production",
    state = "READY",
  ): VercelDeployment => ({ uid, created, target, state, url: null });

  it("keeps production and the 3 newest other production deployments", () => {
    const all = [
      d("p6", 60),
      d("p5", 50),
      d("pv", 55, null),
      d("p4", 40, "production", "ERROR"),
      d("p3", 30),
      d("p2", 20),
      d("p1", 10),
      d("b", 70, null, "BUILDING"),
    ];
    // Production was rolled back to p3.
    const { keep, remove } = deploymentsToPrune(all, {
      currentId: "p3",
      keep: 3,
    });
    expect(keep.map((x) => x.uid)).toEqual(["b", "p6", "p5", "p3", "p2"]);
    expect(remove.map((x) => x.uid)).toEqual(["pv", "p4", "p1"]);
  });

  it("keeps the newest ready production when production is unknown", () => {
    const { keep } = deploymentsToPrune([d("p2", 20), d("p1", 10)], {
      currentId: null,
      keep: 0,
    });
    expect(keep.map((x) => x.uid)).toEqual(["p2"]);
  });
});

describe("the network guard", () => {
  it("blocks api.vercel.com in tests", async () => {
    await expect(
      fetch("https://api.vercel.com/v6/deployments"),
    ).rejects.toThrow("Tests must not call paid APIs");
  });
});
