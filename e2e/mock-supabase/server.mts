/**
 * A stand-in for Supabase in the end-to-end tests (D32): just the calls
 * practice pages make, signed out or signed in as the practices' author
 * (any access token is accepted as AUTHOR; the browser's cloud sync
 * finds nothing and its writes are refused). The E2E build points
 * NEXT_PUBLIC_SUPABASE_URL here (npm run build:e2e), and Playwright starts
 * it next to the app (playwright.config.ts). Practices come from
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
 * or `in.(<x>,<y>)`. Unknown columns are ignored.
 */
function matching(params: URLSearchParams): Row[] {
  let rows = practices;
  for (const column of ["id", "user_id"]) {
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
  return rows;
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors).end();
    return;
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
  if (url.pathname === "/rest/v1/practices" && request.method === "GET") {
    json(200, matching(url.searchParams));
    return;
  }
  if (url.pathname === "/auth/v1/user") {
    json(200, AUTHOR);
    return;
  }
  // Anything else finds nothing (reads) or isn't allowed (writes).
  json(request.method === "GET" ? 200 : 401, []);
}).listen(PORT, () => {
  console.log(`Mock Supabase on http://localhost:${PORT}`);
});
