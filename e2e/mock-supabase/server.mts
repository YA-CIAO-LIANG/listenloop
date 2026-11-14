import { randomUUID } from "node:crypto";
/**
 * A stand-in for Supabase in the end-to-end tests (D32): just the calls
 * practice pages make, signed out or signed in (any access token is
 * accepted, as the account it names; the browser's cloud sync finds
 * nothing and its writes are refused). Shared practices' sentences follow
 * can_practice (D106): their author, paid plans, and admins. The E2E
 * build points NEXT_PUBLIC_SUPABASE_URL here (npm run build:e2e), and
 * Playwright starts it next to the app (playwright.config.ts). Practices come from
 * practices.json; every audio file is a second of silence.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54329);

/** The signed-in user, who made every practice in practices.json. */
const AUTHOR = {
  id: "e2e-author",
  aud: "authenticated",
  role: "authenticated",
  email: "author@example.com",
};

type Row = { id: string; [key: string]: unknown };
const folders: {
  id: string;
  user_id: string;
  title: string;
  visibility: string;
  created_at: string;
}[] = [];

const practices: Row[] = Object.values(
  JSON.parse(
    readFileSync(new URL("./practices.json", import.meta.url), "utf8"),
  ) as Record<string, Row>,
).map((row) => ({ created_at: "2026-11-01T02:00:00Z", ...row }));

/** Accounts on the paid plan's waiting list. */
const waitlist = new Set<string>();
const intents: Record<string, unknown>[] = [];
const sentenceReports: Record<string, unknown>[] = [];

/**
 * Payments (D85), kept while the server runs: what the fake provider's
 * webhooks write with the secret key, read back by the account and
 * admin pages. Plans changed by those webhooks are in `plans`.
 */
const tables: Record<string, Row[]> = {
  // Price experiments and the price survey (D174), kept while running.
  price_experiments: [],
  price_overrides: [],
  price_survey_responses: [],
  // Day 7 surveys (D164): two answers for the admin pages; new ones add.
  week_surveys: [
    {
      id: "5e1f0a2b-0c3d-4e5f-8a9b-000000000001",
      created_at: "2026-11-01T10:00:00Z",
      user_id: "e2e-learner",
      video_id: "sintel",
      week: 1,
      score: 9,
      comment: "第 7 天看到進步很有成就感",
    },
    {
      id: "5e1f0a2b-0c3d-4e5f-8a9b-000000000002",
      created_at: "2026-11-02T10:00:00Z",
      user_id: "e2e-author",
      video_id: "sintel",
      week: 1,
      score: 6,
      comment: null,
    },
  ],
  subscriptions: [],
  payments: [],
  payment_events: [],
  // Two suggested fixes to the official practice (D117), for the admin's
  // review page: accepting one writes its sentence below.
  content_fixes: [
    {
      id: "0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a00",
      practice_id: "7b2d4f60-1a3c-4e5b-8d9f-0a1b2c3d4e5f",
      sentence_index: 0,
      field: "zh",
      kind: "translation",
      current: "可以看一下你的護照嗎？",
      suggested: "可以讓我看一下你的護照嗎？",
      reason: "E2E：語氣更有禮貌。",
      detail: {},
      status: "pending",
      created_at: "2026-11-12T00:00:00Z",
    },
    {
      id: "0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a01",
      practice_id: "7b2d4f60-1a3c-4e5b-8d9f-0a1b2c3d4e5f",
      sentence_index: 1,
      field: "zh",
      kind: "full-width",
      current: "x",
      suggested: "y",
      reason: null,
      detail: {},
      status: "pending",
      created_at: "2026-11-12T00:00:01Z",
    },
  ],
};
const conflictKeys: Record<string, string[]> = {
  subscriptions: ["user_id"],
  payments: ["provider_payment_id"],
  payment_events: ["provider", "event_id"],
  content_fixes: ["id"],
  price_experiments: ["id"],
  price_overrides: ["plan"],
  price_survey_responses: ["user_id", "visitor_id"],
};
// e2e-paid is on the paid plan from the start (paid features, D97).
const plans = new Map<string, string>([["e2e-paid", "paid"]]);

/** The `column=eq.value` filters of a PostgREST request. */
function eqFilters(params: URLSearchParams): [string, string][] {
  return [...params.entries()].flatMap(([column, value]) => {
    const eq = /^eq\.(.*)$/.exec(value);
    return eq ? [[column, eq[1]] as [string, string]] : [];
  });
}

/** One of the payment tables: insert or upsert, update, read, delete. */
async function paymentTable(
  name: string,
  request: import("node:http").IncomingMessage,
  url: URL,
  sub: string | null,
): Promise<[number, Row[]]> {
  const rows = tables[name];
  const filters = eqFilters(url.searchParams);
  const matches = (row: Row) =>
    filters.every(([column, value]) => String(row[column]) === value) &&
    // Row level security: people read only their own rows.
    (sub === null || row.user_id === sub);
  if (request.method === "GET") return [200, rows.filter(matches)];
  if (request.method === "DELETE") {
    tables[name] = rows.filter((row) => !matches(row));
    return [200, []];
  }
  // Only the server (secret key, no user) writes these.
  if (sub !== null) return [401, []];
  const body = JSON.parse((await readBody(request)) || "null");
  if (request.method === "PATCH") {
    const changed = rows.filter(matches);
    for (const row of changed) Object.assign(row, body);
    return [200, changed];
  }
  const keys = (url.searchParams.get("on_conflict") ?? "")
    .split(",")
    .filter(Boolean);
  const conflict = keys.length ? keys : conflictKeys[name];
  const ignore = String(request.headers.prefer ?? "").includes(
    "ignore-duplicates",
  );
  const written: Row[] = [];
  for (const incoming of Array.isArray(body) ? body : [body]) {
    const existing = rows.find((row) =>
      conflict.every((key) => row[key] === incoming[key]),
    );
    if (existing) {
      if (!ignore) written.push(Object.assign(existing, incoming));
      continue;
    }
    const row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...incoming,
    };
    rows.push(row);
    written.push(row);
  }
  return [201, written];
}

/**
 * Site-wide tables (D155 and later): anyone reads, only the secret key
 * writes. Kept while the server runs; /__reset-ops puts them back.
 */
const opsDefaults = (): Record<string, Row[]> => ({
  site_settings: [
    { id: "true", maintenance: false, read_only: false, features: {} },
  ],
  site_announcements: [],
});
let opsTables = opsDefaults();

async function opsTable(
  name: string,
  request: import("node:http").IncomingMessage,
  url: URL,
): Promise<[number, Row[] | Row | null]> {
  const rows = opsTables[name];
  const filters = eqFilters(url.searchParams).filter(
    ([column]) => column !== "id" || name !== "site_settings",
  );
  const matches = (row: Row) =>
    filters.every(([column, value]) => String(row[column]) === value);
  const single = String(request.headers.accept ?? "").includes(
    "vnd.pgrst.object",
  );
  if (request.method === "GET") {
    const found = rows.filter(matches);
    const limit = Number(url.searchParams.get("limit") ?? Infinity);
    const sorted =
      url.searchParams.get("order")?.endsWith(".desc") === true
        ? [...found].reverse()
        : found;
    const page = sorted.slice(0, limit);
    return [200, single ? (page[0] ?? null) : page];
  }
  if (request.headers.authorization !== "Bearer e2e-secret-key") {
    return [401, []];
  }
  const body = JSON.parse((await readBody(request)) || "null");
  if (request.method === "PATCH") {
    const changed = rows.filter(matches);
    for (const row of changed) Object.assign(row, body);
    return [200, single ? (changed[0] ?? null) : changed];
  }
  if (request.method === "POST") {
    const written = (Array.isArray(body) ? body : [body]).map((incoming) => ({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...incoming,
    }));
    rows.push(...written);
    return [201, single ? written[0] : written];
  }
  return [405, []];
}

/**
 * The referral program (D177), kept while the server runs: codes,
 * referrals and rewards (written with the secret key), the sign-up IP
 * hashes, and the cloud progress of referral test accounts (ids starting
 * "e2e-ref-"), which the server reads to check a friend's Day 1. Other
 * accounts' progress stays unsaved, as before.
 */
const referralTables: Record<string, Row[]> = {
  referral_codes: [],
  referrals: [],
  referral_rewards: [],
  account_signals: [],
  progress: [],
};
const referralConflict: Record<string, string[]> = {
  referral_codes: ["user_id"],
  referrals: ["referee_id"],
  referral_rewards: ["referral_id", "user_id"],
  account_signals: ["user_id"],
  progress: ["user_id", "video_id"],
};
const isReferralAccount = (id: unknown) =>
  typeof id === "string" &&
  (id.startsWith("e2e-ref-") || id.startsWith("e2e-class-"));

/**
 * Classroom (D103), kept while the server runs, for the usability test's
 * class flows (D179): teachers are accounts whose id starts
 * "e2e-class-teacher" (a 40-seat class plan); students' progress is kept
 * like referral accounts' ("e2e-class-" ids) so class_progress can read it.
 */
const classTables: Record<string, Row[]> = {
  classes: [],
  class_members: [],
  assignments: [],
  announcements: [],
};
const isClassTeacher = (id: unknown) =>
  typeof id === "string" && id.startsWith("e2e-class-teacher");

function classVisible(sub: string | null, classId: unknown): boolean {
  const row = classTables.classes.find((c) => c.id === classId);
  if (!row || !sub) return false;
  return (
    row.teacher_id === sub ||
    classTables.class_members.some(
      (m) => m.class_id === classId && m.user_id === sub,
    )
  );
}

async function classTable(
  name: string,
  request: import("node:http").IncomingMessage,
  url: URL,
): Promise<[number, Row[] | Row | null]> {
  const sub = tokenSubject(request.headers.authorization);
  const single = String(request.headers.accept ?? "").includes(
    "vnd.pgrst.object",
  );
  const filtered = () =>
    classTables[name].filter((row) =>
      [...url.searchParams.entries()].every(
        ([column, filter]) =>
          RESERVED.has(column) ||
          (filter === "is.null"
            ? row[column] === null || row[column] === undefined
            : passes(row, column, filter)),
      ),
    );
  // Row level security: teachers their classes, students theirs.
  const mine = (row: Row) =>
    name === "classes"
      ? classVisible(sub, row.id)
      : name === "class_members"
        ? classTables.classes.some(
            (c) => c.id === row.class_id && c.teacher_id === sub,
          ) || row.user_id === sub
        : classVisible(sub, row.class_id);
  if (request.method === "GET") {
    let rows = filtered().filter(mine);
    if (name === "classes") {
      rows = rows.map((row) => ({
        ...row,
        class_members: [
          {
            count: classTables.class_members.filter(
              (m) => m.class_id === row.id,
            ).length,
          },
        ],
      }));
    }
    return [200, single ? (rows[0] ?? null) : rows];
  }
  if (request.method === "DELETE") {
    const gone = filtered().filter(mine);
    classTables[name] = classTables[name].filter((row) => !gone.includes(row));
    return [200, []];
  }
  if (request.method !== "POST") return [405, []];
  const body = JSON.parse((await readBody(request)) || "null");
  const written: Row[] = [];
  for (const incoming of [body].flat()) {
    if (name === "classes" && incoming.teacher_id !== sub) return [401, []];
    if (
      name !== "classes" &&
      !classTables.classes.some(
        (c) => c.id === incoming.class_id && c.teacher_id === sub,
      )
    ) {
      return [401, []];
    }
    const row = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      archived_at: null,
      ...incoming,
    };
    classTables[name].push(row);
    written.push(row);
  }
  return [201, single ? (written[0] ?? null) : written];
}

/** Whether a row passes one PostgREST filter (`eq`, `in`, `gte`, …). */
function passes(row: Row, column: string, filter: string): boolean {
  const value = row[column];
  const [op, ...rest] = filter.split(".");
  const arg = rest.join(".");
  switch (op) {
    case "eq":
      return String(value) === arg;
    case "in":
      return arg
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((v) => v.replace(/"/g, ""))
        .includes(String(value));
    case "gte":
      return String(value) >= arg;
    case "gt":
      return String(value) > arg;
    case "lte":
      return String(value) <= arg;
    case "lt":
      return String(value) < arg;
    default:
      return true;
  }
}

const RESERVED = new Set(["select", "order", "limit", "on_conflict", "or"]);

function referralRows(name: string, params: URLSearchParams): Row[] {
  let rows = referralTables[name].filter((row) =>
    [...params.entries()].every(
      ([column, filter]) => RESERVED.has(column) || passes(row, column, filter),
    ),
  );
  // `or=(a.eq.x,b.eq.y)`: any of them.
  const or = /^\((.*)\)$/.exec(params.get("or") ?? "");
  if (or) {
    const parts = or[1].split(",").map((part) => {
      const [column, ...filter] = part.split(".");
      return [column, filter.join(".")] as const;
    });
    rows = rows.filter((row) =>
      parts.some(([column, filter]) => passes(row, column, filter)),
    );
  }
  const limit = Number(params.get("limit") ?? Infinity);
  return rows.slice(0, limit);
}

async function referralTable(
  name: string,
  request: import("node:http").IncomingMessage,
  url: URL,
): Promise<[number, Row[] | Row | null]> {
  const sub = tokenSubject(request.headers.authorization);
  const service = request.headers.authorization === "Bearer e2e-secret-key";
  const single = String(request.headers.accept ?? "").includes(
    "vnd.pgrst.object",
  );
  // Row level security: a person reads their own progress; the other
  // tables are read and written with the secret key only.
  const own = name === "progress" && isReferralAccount(sub);
  if (!service && !own) {
    return [request.method === "GET" ? 200 : 401, single ? null : []];
  }
  const visible = (rows: Row[]) =>
    own ? rows.filter((row) => row.user_id === sub) : rows;
  if (request.method === "GET") {
    const rows = visible(referralRows(name, url.searchParams));
    return [200, single ? (rows[0] ?? null) : rows];
  }
  const body = JSON.parse((await readBody(request)) || "null");
  if (request.method === "PATCH") {
    const changed = visible(referralRows(name, url.searchParams));
    for (const row of changed) Object.assign(row, body);
    return [200, changed];
  }
  if (request.method !== "POST") return [405, []];
  const keys = (url.searchParams.get("on_conflict") ?? "")
    .split(",")
    .filter(Boolean);
  const conflict = keys.length ? keys : referralConflict[name];
  const prefer = String(request.headers.prefer ?? "");
  const upsert = prefer.includes("resolution=");
  const ignore = prefer.includes("ignore-duplicates");
  const written: Row[] = [];
  for (const incoming of [body].flat() as Record<string, unknown>[]) {
    if (own && incoming.user_id !== sub) return [401, []];
    const existing = referralTables[name].find((row) =>
      conflict.every((key) => row[key] === incoming[key]),
    );
    if (existing) {
      // A unique column taken: an insert fails, an upsert merges.
      if (!upsert) return [409, { code: "23505" } as unknown as Row];
      if (!ignore) written.push(Object.assign(existing, incoming));
      continue;
    }
    const row = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...(name === "referrals" ? { status: "pending" } : {}),
      ...incoming,
    };
    referralTables[name].push(row);
    written.push(row);
  }
  return [201, single ? (written[0] ?? null) : written];
}

/** A session for a referral test account (the fake email sign-up). */
function referralSession(id: string) {
  const base64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = 4_102_444_800;
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `${id}@example.com`,
  };
  return {
    access_token: [
      base64url({ alg: "HS256", typ: "JWT" }),
      base64url({
        sub: id,
        email: user.email,
        aud: "authenticated",
        role: "authenticated",
        exp: expiresAt,
        amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }],
      }),
      base64url("signature"),
    ].join("."),
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user,
  };
}

/** One second of 8 kHz, 8-bit mono silence. */
function silentWav(): Buffer {
  const samples = 8000;
  const wav = Buffer.alloc(44 + samples, 128);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  return wav;
}

/**
 * Rows matching PostgREST filters on the columns the app uses: `eq.<x>`,
 * or `in.(<x>,<y>)`, and the library search's ranges. Unknown columns are
 * ignored.
 */
function matching(params: URLSearchParams): Row[] {
  let rows = practices;
  for (const column of ["id", "user_id", "official"]) {
    const filter = params.get(column);
    if (!filter) continue;
    const eq = /^eq\.(.+)$/.exec(filter);
    const list = /^in\.\((.*)\)$/.exec(filter);
    const values = eq
      ? [eq[1]]
      : list
        ? list[1].split(",").map((value) => value.replace(/"/g, ""))
        : [];
    rows = rows.filter((row) => values.includes(String(row[column])));
  }
  // The library's search (D104): `categories=ov.{a,b}` (the generated
  // column is the category as a list) and `duration_sec=gte.N` / `lte.N`.
  const overlaps = /^ov\.\{(.*)\}$/.exec(params.get("categories") ?? "");
  if (overlaps) {
    const wanted = overlaps[1].split(",").map((v) => v.replace(/"/g, ""));
    rows = rows.filter((row) => wanted.includes(String(row.category)));
  }
  for (const filter of params.getAll("duration_sec")) {
    const bound = /^(gte|lte)\.(\d+)$/.exec(filter);
    if (!bound) continue;
    const limit = Number(bound[2]);
    rows = rows.filter((row) => {
      const seconds = row.duration_sec;
      if (typeof seconds !== "number") return false;
      return bound[1] === "gte" ? seconds >= limit : seconds <= limit;
    });
  }
  return rows;
}

/** can_practice (D106): official, the author's, a paying plan's, an admin's. */
function mayPractice(row: Row, sub: string | null): boolean {
  if (row.official || (sub && row.user_id === sub)) return true;
  if (sub === "e2e-admin") return true;
  const plan = sub ? plans.get(sub) : undefined;
  return plan === "paid" || plan === "pro";
}

/** A request's body as text. */
function readBody(request: import("node:http").IncomingMessage) {
  return new Promise<string>((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
  });
}

/** The `sub` of a "Bearer <jwt>" header, unverified (it's a stand-in). */
function tokenSubject(header: string | undefined): string | null {
  const payload = header?.replace(/^Bearer /, "").split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const requestCounts = new Map<string, number>();

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors).end();
    return;
  }
  // How many requests each path got (the load test counts database
  // reads per page view, D133); /__stats?reset=1 starts over.
  if (url.pathname === "/__stats") {
    const body = JSON.stringify(Object.fromEntries(requestCounts));
    if (url.searchParams.get("reset") === "1") requestCounts.clear();
    response.writeHead(200, { "content-type": "application/json" }).end(body);
    return;
  }
  if (url.pathname !== "/health") {
    requestCounts.set(url.pathname, (requestCounts.get(url.pathname) ?? 0) + 1);
  }
  if (url.pathname === "/health") {
    response.writeHead(200, cors).end("ok");
    return;
  }
  if (url.pathname === "/__reset-ops") {
    opsTables = opsDefaults();
    response.writeHead(204, cors).end();
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/public/")) {
    response
      .writeHead(200, { ...cors, "content-type": "audio/wav" })
      .end(silentWav());
    return;
  }
  const json = (status: number, body: unknown) =>
    response
      .writeHead(status, { ...cors, "content-type": "application/json" })
      .end(JSON.stringify(body));
  // A learner's recording (D130): the server asks for a signed upload URL
  // (POST), and the browser uploads to it (PUT). Nothing is kept.
  if (url.pathname.startsWith("/storage/v1/object/upload/sign/uploads/")) {
    const path = url.pathname.slice("/storage/v1/object/upload/sign/".length);
    await readBody(request);
    json(
      200,
      request.method === "PUT"
        ? { Key: path }
        : { url: `/object/upload/sign/${path}?token=e2e-upload` },
    );
    return;
  }
  const ops = /^\/rest\/v1\/(site_settings|site_announcements)$/.exec(
    url.pathname,
  );
  if (ops) {
    const [status, body] = await opsTable(ops[1], request, url);
    json(status, body);
    return;
  }
  // Sign-ups in stages (D132): open, 3 of 50 places taken; the waiting
  // list takes anyone (nothing is kept).
  if (url.pathname === "/rest/v1/signup_settings" && request.method === "GET") {
    json(200, { open: true, cap: 50 });
    return;
  }
  if (url.pathname === "/rest/v1/rpc/beta_admitted_count") {
    json(200, 3);
    return;
  }
  if (url.pathname === "/rest/v1/beta_waitlist" && request.method === "POST") {
    await readBody(request);
    response.writeHead(201, cors).end();
    return;
  }
  // Vocabulary quizzes (D136): saved, nothing kept; none to list.
  if (url.pathname === "/rest/v1/vocab_quiz_attempts") {
    await readBody(request);
    if (request.method === "POST") response.writeHead(201, cors).end();
    else json(200, []);
    return;
  }
  // What each account made (D143): the author has used this week's
  // 2 free minutes (two of a minute, just now); nobody else made any.
  if (
    url.pathname === "/rest/v1/practice_creations" &&
    request.method === "GET"
  ) {
    const sub = tokenSubject(request.headers.authorization);
    const now = new Date().toISOString();
    json(
      200,
      sub === "e2e-author"
        ? [
            { seconds: 60, created_at: now },
            { seconds: 60, created_at: now },
          ]
        : [],
    );
    return;
  }
  // My materials' folders (D147): each account's own, kept in memory.
  if (url.pathname === "/rest/v1/collections") {
    const sub = tokenSubject(request.headers.authorization);
    const body = JSON.parse((await readBody(request)) || "{}");
    const id = /^eq\.(.+)$/.exec(url.searchParams.get("id") ?? "")?.[1];
    const mine = folders.filter((folder) => folder.user_id === sub);
    if (!sub) {
      json(request.method === "GET" ? 200 : 401, []);
    } else if (request.method === "GET") {
      json(200, mine);
    } else if (request.method === "POST") {
      const folder = {
        id: randomUUID(),
        user_id: sub,
        title: String(body.title ?? ""),
        visibility: "private",
        created_at: new Date().toISOString(),
      };
      folders.push(folder);
      json(201, [{ id: folder.id }]);
    } else {
      const folder = mine.find((f) => f.id === id);
      if (folder && request.method === "PATCH") Object.assign(folder, body);
      if (folder && request.method === "DELETE") {
        folders.splice(folders.indexOf(folder), 1);
        for (const row of practices) {
          if (row.collection_id === folder.id) row.collection_id = null;
        }
      }
      json(200, folder ? [{ id: folder.id }] : []);
    }
    return;
  }
  // Moving one's own practice into a folder or out (D147).
  if (url.pathname === "/rest/v1/practices" && request.method === "PATCH") {
    const sub = tokenSubject(request.headers.authorization);
    const body = JSON.parse((await readBody(request)) || "{}");
    const id = /^eq\.(.+)$/.exec(url.searchParams.get("id") ?? "")?.[1];
    const row = practices.find((p) => p.id === id && p.user_id === sub);
    if (row && "collection_id" in body) row.collection_id = body.collection_id;
    json(200, row ? [{ id: row.id }] : []);
    return;
  }
  // No speech to text used this month (D130).
  if (url.pathname === "/rest/v1/rpc/month_audio_ms") {
    json(200, [{ site: 0, mine: 0 }]);
    return;
  }
  // Profiles (D50): the admin account's says so; everyone else is a user.
  if (url.pathname === "/rest/v1/profiles" && request.method === "GET") {
    const sub = tokenSubject(request.headers.authorization);
    json(200, [
      {
        number: sub === "e2e-admin" ? 0 : 1,
        role: sub === "e2e-admin" ? "admin" : "user",
        status: "active",
        plan: (sub && plans.get(sub)) ?? "free",
        // The author made both practices in practices.json: the free
        // plan's one-practice trial is used up (D72). The learner hasn't
        // made one yet.
        practices_created: sub === "e2e-author" ? 2 : 0,
        // Signed in with a school email this month (D144).
        student_verified_at:
          sub === "e2e-student" ? new Date().toISOString() : null,
        // A teacher on the standard class plan (D173, D179).
        classroom_seats: isClassTeacher(sub) ? 40 : null,
      },
    ]);
    return;
  }
  // A webhook's plan change (D85), with the secret key.
  if (url.pathname === "/rest/v1/profiles" && request.method === "PATCH") {
    const body = JSON.parse((await readBody(request)) || "{}");
    const user = eqFilters(url.searchParams).find(([c]) => c === "user_id");
    if (user && typeof body.plan === "string") plans.set(user[1], body.plan);
    json(200, []);
    return;
  }
  const table =
    /^\/rest\/v1\/(subscriptions|payments|payment_events|content_fixes|week_surveys|price_experiments|price_overrides|price_survey_responses)$/.exec(
      url.pathname,
    );
  if (table) {
    const [status, rows] = await paymentTable(
      table[1],
      request,
      url,
      tokenSubject(request.headers.authorization),
    );
    // `.single()` asks for one object, not a list.
    const single = String(request.headers.accept ?? "").includes(
      "vnd.pgrst.object",
    );
    json(status, single ? (rows[0] ?? null) : rows);
    return;
  }
  if (url.pathname === "/rest/v1/practices" && request.method === "GET") {
    // Row level security on sentences and notes (D106): shared practices
    // only for their author, paying plans, and admins.
    const sub = tokenSubject(request.headers.authorization);
    json(
      200,
      matching(url.searchParams).map((row) =>
        mayPractice(row, sub)
          ? row
          : { ...row, practice_sentences: [], vocab: [], grammar: [] },
      ),
    );
    return;
  }
  // Which public practices are ready, counted without reading them.
  if (url.pathname === "/rest/v1/rpc/public_practice_readiness") {
    const { targets = [] } = JSON.parse((await readBody(request)) || "{}");
    json(
      200,
      practices
        .filter((row) => targets.includes(row.id))
        .map((row) => {
          const sentences = row.practice_sentences as { audio_path: unknown }[];
          return {
            practice_id: row.id,
            sentences: sentences.length,
            voiced: sentences.filter((s) => s.audio_path).length,
          };
        }),
    );
    return;
  }
  // A shared practice's preview (D106): three sentences, no notes.
  if (url.pathname === "/rest/v1/rpc/practice_preview") {
    const { target } = JSON.parse((await readBody(request)) || "{}");
    const row = practices.find((p) => p.id === target);
    if (!row || row.official || row.visibility !== "public") {
      json(200, null);
      return;
    }
    const sentences = row.practice_sentences as {
      i: number;
      en: string;
      zh: string;
      audio_path: string | null;
    }[];
    json(200, {
      sentence_count: sentences.length,
      sentences: sentences
        .filter((s) => s.i < 3)
        .map(({ i, en, zh }) => ({ i, en, zh })),
      audio_path: sentences.find((s) => s.i === 0)?.audio_path ?? null,
    });
    return;
  }
  if (url.pathname === "/rest/v1/rpc/can_practice") {
    const { target } = JSON.parse((await readBody(request)) || "{}");
    const row = practices.find((p) => p.id === target);
    const sub = tokenSubject(request.headers.authorization);
    json(200, !!row && mayPractice(row, sub));
    return;
  }
  if (url.pathname === "/rest/v1/rpc/practice_notes") {
    const { target } = JSON.parse((await readBody(request)) || "{}");
    const row = practices.find((p) => p.id === target);
    const sub = tokenSubject(request.headers.authorization);
    json(
      200,
      row && mayPractice(row, sub)
        ? [{ vocab: row.vocab, grammar: row.grammar }]
        : [],
    );
    return;
  }
  // A practice's sentences, read and written with the secret key (an
  // admin accepting a suggested fix, D117).
  if (url.pathname === "/rest/v1/practice_sentences") {
    const filters = eqFilters(url.searchParams);
    const value = (column: string) => filters.find(([c]) => c === column)?.[1];
    const row = practices.find((p) => p.id === value("practice_id"));
    const sentences = (row?.practice_sentences ?? []) as Row[];
    const hits = sentences.filter(
      (s) => value("i") === undefined || String(s.i) === value("i"),
    );
    if (request.method === "PATCH") {
      if (tokenSubject(request.headers.authorization) !== null) {
        json(401, []);
        return;
      }
      const body = JSON.parse((await readBody(request)) || "{}");
      for (const sentence of hits) Object.assign(sentence, body);
    }
    json(200, hits);
    return;
  }
  // Sentence reports (D113): learners' inserts are kept while the server
  // runs; none is fixed yet, so the home page has no notice.
  if (url.pathname === "/rest/v1/sentence_reports") {
    if (request.method === "POST") {
      const sub = tokenSubject(request.headers.authorization);
      if (!sub) {
        json(401, []);
        return;
      }
      sentenceReports.push(JSON.parse((await readBody(request)) || "{}"));
      response.writeHead(201, cors).end();
      return;
    }
    json(200, []);
    return;
  }
  // Steps toward paying (D93), kept while the server runs; the admin's
  // interest page reads them back.
  if (url.pathname === "/rest/v1/intent_events") {
    if (request.method === "POST") {
      const rows = JSON.parse((await readBody(request)) || "[]");
      for (const row of [rows].flat()) {
        intents.push({ ...row, created_at: new Date().toISOString() });
      }
      response.writeHead(201, cors).end();
      return;
    }
    // Price experiments read their own steps (D174).
    const filters = eqFilters(url.searchParams);
    json(
      200,
      intents.filter((row) =>
        filters.every(([column, value]) => String(row[column]) === value),
      ),
    );
    return;
  }
  // The paid plan's waiting list (D72), kept while the server runs.
  if (url.pathname === "/rest/v1/waitlist") {
    const sub = tokenSubject(request.headers.authorization);
    if (request.method === "POST") {
      // The person's own insert, or the server's upsert with the secret
      // key (D102), which names the account in the row.
      const row = JSON.parse((await readBody(request)) || "{}");
      const id = sub ?? [row].flat()[0]?.user_id;
      if (id) waitlist.add(id);
      response.writeHead(201, cors).end();
      return;
    }
    json(200, sub && waitlist.has(sub) ? [{ user_id: sub }] : []);
    return;
  }
  // The admin's daily AI allowances are used up (D77), so their paid
  // calls are refused and the page says which limit and when it resets;
  // the learner still has today's (the fakes cost nothing anyway).
  if (
    url.pathname === "/rest/v1/rpc/reserve_api_cost" ||
    url.pathname === "/rest/v1/rpc/reserve_api_batch_cost"
  ) {
    const args = JSON.parse((await readBody(request)) || "{}");
    json(200, args.target_user !== "e2e-admin");
    return;
  }
  // Nothing spent this month, site-wide (D77).
  if (url.pathname === "/rest/v1/rpc/month_api_cost") {
    json(200, 0);
    return;
  }
  // The library's totals (D70): one learner on Sintel, no audio lengths.
  if (url.pathname === "/rest/v1/rpc/material_learner_counts") {
    json(200, [{ video_id: "sintel", learners: 1 }]);
    return;
  }
  // The Beta test page (D165): one tester three days into the week and
  // idle for three days, one who joined two days ago and hasn't started.
  if (url.pathname === "/rest/v1/rpc/beta_tester_activity") {
    const ago = (days: number) =>
      new Date(Date.now() - days * 86_400_000).toISOString();
    json(200, [
      {
        user_id: "e2e-learner",
        number: 2,
        invite_id: "0b9c7d1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
        invite_note: "第一梯",
        joined_at: ago(5),
        last_sign_in_at: ago(3),
        last_activity: ago(3),
        progress: [
          {
            video: "sintel",
            week: 1,
            status: "in-progress",
            done: [1, 2, 3],
            weeks: 0,
            updated: ago(3),
          },
        ],
      },
      {
        user_id: "e2e-paid",
        number: 3,
        invite_id: "0b9c7d1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
        invite_note: "第一梯",
        joined_at: ago(2),
        last_sign_in_at: ago(2),
        last_activity: null,
        progress: [],
      },
    ]);
    return;
  }
  if (url.pathname === "/rest/v1/rpc/practice_audio_bytes") {
    json(200, []);
    return;
  }
  // Classroom (D103, D179): classes, members, assignments, announcements.
  const classPath =
    /^\/rest\/v1\/(classes|class_members|assignments|announcements)$/.exec(
      url.pathname,
    );
  if (classPath) {
    const [status, body] = await classTable(classPath[1], request, url);
    json(status, body);
    return;
  }
  if (url.pathname === "/rest/v1/rpc/join_class") {
    const sub = tokenSubject(request.headers.authorization);
    const { code, name, consent } = JSON.parse(
      (await readBody(request)) || "{}",
    );
    const target = classTables.classes.find(
      (c) => c.invite_code === String(code).toUpperCase() && !c.archived_at,
    );
    if (!sub || !target || target.teacher_id === sub) {
      json(200, null);
      return;
    }
    const existing = classTables.class_members.find(
      (m) => m.class_id === target.id && m.user_id === sub,
    );
    if (existing) existing.display_name = name;
    else {
      classTables.class_members.push({
        id: `${target.id}:${sub}`,
        class_id: target.id,
        user_id: sub,
        display_name: String(name).slice(0, 40),
        minor_consent: consent === true,
        joined_at: new Date().toISOString(),
      });
    }
    json(200, target.id);
    return;
  }
  if (url.pathname === "/rest/v1/rpc/class_progress") {
    const sub = tokenSubject(request.headers.authorization);
    const { target } = JSON.parse((await readBody(request)) || "{}");
    const owned = classTables.classes.some(
      (c) => c.id === target && c.teacher_id === sub,
    );
    const members = new Set(
      classTables.class_members
        .filter((m) => m.class_id === target)
        .map((m) => m.user_id),
    );
    const assigned = new Set(
      classTables.assignments
        .filter((a) => a.class_id === target)
        .map((a) => a.video_id),
    );
    json(
      200,
      owned
        ? referralTables.progress
            .filter((p) => members.has(p.user_id) && assigned.has(p.video_id))
            .map(({ user_id, video_id, data }) => ({ user_id, video_id, data }))
        : [],
    );
    return;
  }
  // The referral program (D177): its tables, the sign-up IP hashes, and
  // referral test accounts' progress.
  const referral =
    /^\/rest\/v1\/(referral_codes|referrals|referral_rewards|account_signals|progress)$/.exec(
      url.pathname,
    );
  if (
    referral &&
    (referral[1] !== "progress" ||
      isReferralAccount(tokenSubject(request.headers.authorization)) ||
      url.searchParams.get("user_id")?.startsWith("eq.e2e-ref-") ||
      url.searchParams.get("user_id")?.startsWith("eq.e2e-class-"))
  ) {
    const [status, body] = await referralTable(referral[1], request, url);
    json(status, body);
    return;
  }
  if (url.pathname === "/rest/v1/rpc/qualify_referral") {
    const args = JSON.parse((await readBody(request)) || "{}");
    const row = referralTables.referrals.find(
      (r) => r.id === args.target && r.status === "pending",
    );
    if (!row) {
      json(200, false);
      return;
    }
    Object.assign(row, {
      status: "qualified",
      settled_at: new Date().toISOString(),
    });
    const expires = new Date(
      Date.now() + Number(args.valid_days) * 86_400_000,
    ).toISOString();
    for (const [user, role, minutes] of [
      [row.referee_id, "referee", args.referee_minutes],
      [row.referrer_id, "referrer", args.referrer_minutes],
    ] as const) {
      if (!user || !(Number(minutes) > 0)) continue;
      referralTables.referral_rewards.push({
        id: randomUUID(),
        referral_id: row.id,
        user_id: user,
        role,
        minutes: Number(minutes),
        created_at: new Date().toISOString(),
        expires_at: expires,
      });
    }
    json(200, true);
    return;
  }
  // A new account's first sign-in (D132): public sign-ups are open.
  if (url.pathname === "/rest/v1/rpc/admit_account") {
    await readBody(request);
    json(200, "open");
    return;
  }
  // The email link of a referral test account's sign-up (D101): its
  // token is the account id.
  if (url.pathname === "/auth/v1/verify" && request.method === "POST") {
    const { token_hash: token } = JSON.parse((await readBody(request)) || "{}");
    if (!isReferralAccount(token)) {
      json(403, { code: 403, msg: "Token has expired or is invalid" });
      return;
    }
    json(200, referralSession(token));
    return;
  }
  // Signing out (D138): nothing to end on the stand-in.
  if (url.pathname === "/auth/v1/logout") {
    response.writeHead(204, cors).end();
    return;
  }
  if (url.pathname === "/auth/v1/user") {
    const sub = tokenSubject(request.headers.authorization);
    json(200, sub ? { ...AUTHOR, id: sub } : AUTHOR);
    return;
  }
  // Anything else finds nothing (reads) or isn't allowed (writes).
  json(request.method === "GET" ? 200 : 401, []);
}).listen(PORT, () => {
  console.log(`Mock Supabase on http://localhost:${PORT}`);
});
