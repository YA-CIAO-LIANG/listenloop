/**
 * How big the server functions are (D175): reads the file traces Next.js
 * writes next to each route after `npm run build` (.next/server/**\/*.nft.json)
 * and prints the traced size per route group, the shared server runtime,
 * and the largest packages. Vercel bundles these traces into its
 * functions, and every deployment's functions count towards the Hobby
 * plan's 10 GB "Functions Storage", so this is the number to keep small.
 *
 * Local numbers are on this machine's platform (e.g. darwin native
 * packages), so compare before/after on the same machine. Read-only.
 * `npm run size:functions` (add `-- --files 20` to list the largest files).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");
const SERVER = join(NEXT, "server");

if (!existsSync(SERVER)) {
  console.error("No .next/server: run `npm run build` first.");
  process.exit(1);
}

const filesArg = process.argv.indexOf("--files");
const topFiles = filesArg > 0 ? Number(process.argv[filesArg + 1]) || 20 : 0;

function findTraces(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findTraces(full, out);
    else if (entry.name.endsWith(".nft.json")) out.push(full);
  }
  return out;
}

const sizeCache = new Map<string, number>();
function sizeOf(file: string): number {
  let size = sizeCache.get(file);
  if (size === undefined) {
    try {
      const stat = statSync(file);
      size = stat.isFile() ? stat.size : 0;
    } catch {
      size = 0;
    }
    sizeCache.set(file, size);
  }
  return size;
}

/** Absolute paths of the files one trace lists (plus the entry itself). */
function traced(trace: string): Set<string> {
  const { files } = JSON.parse(readFileSync(trace, "utf8")) as {
    files: string[];
  };
  const base = dirname(trace);
  const set = new Set(files.map((file) => resolve(base, file)));
  const entry = trace.replace(/\.nft\.json$/, "");
  if (existsSync(entry)) set.add(entry);
  return set;
}

const sum = (files: Iterable<string>) => {
  let total = 0;
  for (const file of files) total += sizeOf(file);
  return total;
};
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** "app/admin/usage/page.js.nft.json" → "app/admin"; api routes by 2. */
function groupOf(trace: string): string {
  const parts = relative(SERVER, trace).split("/");
  if (parts[0] !== "app") return parts[0].replace(/\.js\.nft\.json$/, "");
  if (parts.length <= 2) return "app/(root)";
  if (parts[1] === "api" && parts.length > 3) return `app/api/${parts[2]}`;
  return `app/${parts[1]}`;
}

const runtimeTrace = join(NEXT, "next-server.js.nft.json");
const runtime = existsSync(runtimeTrace) ? traced(runtimeTrace) : new Set();
const traces = findTraces(SERVER);

const groups = new Map<string, { routes: number; files: Set<string> }>();
const everything = new Set<string>();
for (const trace of traces) {
  const files = traced(trace);
  const name = groupOf(trace);
  const group = groups.get(name) ?? { routes: 0, files: new Set<string>() };
  group.routes += 1;
  for (const file of files) {
    group.files.add(file);
    everything.add(file);
  }
  groups.set(name, group);
}
for (const file of runtime) everything.add(file as string);

console.log(`Traced server files (${traces.length} traces, local build)\n`);
console.log(
  `Server runtime (next-server.js, shared by every function): ${mb(sum(runtime as Set<string>))}`,
);
console.log(
  `All functions together (one copy of each file):        ${mb(sum(everything))}\n`,
);

const rows = [...groups.entries()]
  .map(([name, group]) => {
    const own = [...group.files].filter((file) => !runtime.has(file));
    return {
      group: name,
      routes: group.routes,
      "traced (MB)": Number((sum(group.files) / 1024 / 1024).toFixed(2)),
      "beyond runtime (MB)": Number((sum(own) / 1024 / 1024).toFixed(2)),
    };
  })
  .sort((a, b) => b["traced (MB)"] - a["traced (MB)"]);
console.table(rows);

// The largest packages and folders across every trace.
const byPackage = new Map<string, number>();
for (const file of everything) {
  const rel = relative(ROOT, file);
  const parts = rel.split("/");
  let key: string;
  if (parts[0] === "node_modules") {
    key = parts[1].startsWith("@")
      ? `node_modules/${parts[1]}/${parts[2]}`
      : `node_modules/${parts[1]}`;
  } else if (parts[0] === ".next") {
    key = parts.slice(0, 3).join("/");
  } else {
    key = parts[0];
  }
  byPackage.set(key, (byPackage.get(key) ?? 0) + sizeOf(file));
}
console.log("\nLargest packages and folders (all traces):");
console.table(
  [...byPackage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, bytes]) => ({ path, MB: Number(mb(bytes).split(" ")[0]) })),
);

if (topFiles > 0) {
  console.log(`\nLargest ${topFiles} files:`);
  console.table(
    [...everything]
      .map((file) => ({ file: relative(ROOT, file), bytes: sizeOf(file) }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, topFiles)
      .map(({ file, bytes }) => ({
        file,
        MB: Number(mb(bytes).split(" ")[0]),
      })),
  );
}
