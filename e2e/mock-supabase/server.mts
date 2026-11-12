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
const practices: Row[] = Object.values(
  JSON.parse(
    readFileSync(new URL("./practices.json", import.meta.url), "utf8"),
  ) as Record<string, Row>,
);

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
    /^\/rest\/v1\/(subscriptions|payments|payment_events|content_fixes)$/.exec(
      url.pathname,
    );
  if (table) {
    const [status, rows] = await paymentTable(
      table[1],
      request,
      url,
      tokenSubject(request.headers.authorization),
    );
    json(status, rows);
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
    json(200, intents);
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
  if (url.pathname === "/rest/v1/rpc/practice_audio_bytes") {
    json(200, []);
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
