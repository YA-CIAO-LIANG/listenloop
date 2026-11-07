/**
 * Paid-API usage report (D65; the cost-report skill): totals per
 * operation for the last N Taiwan days (default 7), this month's spend
 * against the Azure credit and F0's free characters, and the cost of each
 * practice made in the period. Read-only, from api_calls; no API calls.
 *
 *   node --env-file=.env.local scripts/cost-report.mts [days]
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const days = Number(process.argv[2] ?? 7);
const CREDIT_USD = 100;
const F0_CHARS = 500_000;

/** Midnight in Taiwan (UTC+8), `back` days before today. */
function taipeiMidnight(back: number): Date {
  const now = new Date(Date.now() + 8 * 3600_000);
  const day = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - back,
  );
  return new Date(day - 8 * 3600_000);
}
const since = taipeiMidnight(days - 1);
const monthStart = (() => {
  const now = new Date(Date.now() + 8 * 3600_000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 8 * 3600_000,
  );
})();
const from = since < monthStart ? since : monthStart;

type Call = {
  created_at: string;
  user_id: string | null;
  provider: string;
  operation: string;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  chars: number;
  cost_micros: number;
};
const calls: Call[] = [];
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await admin
    .from("api_calls")
    .select(
      "created_at, user_id, provider, operation, error, input_tokens, output_tokens, chars, cost_micros",
    )
    .gte("created_at", from.toISOString())
    .order("created_at")
    .range(offset, offset + 999);
  if (error) throw new Error(error.message);
  calls.push(...(data as Call[]));
  if (data.length < 1000) break;
}
const { data: allAzure } = await admin
  .from("api_calls")
  .select("cost_micros")
  .like("provider", "azure-%");

const usd = (micros: number) => `US$${(micros / 1e6).toFixed(4)}`;
const sum = (list: Call[], f: (c: Call) => number) =>
  list.reduce((t, c) => t + f(c), 0);
const period = calls.filter((c) => new Date(c.created_at) >= since);

console.log(
  `\n## Last ${days} days (since ${since.toISOString().slice(0, 10)}, Taiwan time)\n`,
);
const ops = [...new Set(period.map((c) => c.operation))].sort();
console.log(
  "| operation | calls | failed | input tokens | output tokens | chars | cost |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const op of ops) {
  const list = period.filter((c) => c.operation === op);
  console.log(
    `| ${op} | ${list.length} | ${list.filter((c) => c.error).length} | ${sum(list, (c) => c.input_tokens)} | ${sum(list, (c) => c.output_tokens)} | ${sum(list, (c) => c.chars)} | ${usd(sum(list, (c) => c.cost_micros))} |`,
  );
}
console.log(
  `| **total** | ${period.length} | ${period.filter((c) => c.error).length} | ${sum(period, (c) => c.input_tokens)} | ${sum(period, (c) => c.output_tokens)} | ${sum(period, (c) => c.chars)} | ${usd(sum(period, (c) => c.cost_micros))} |`,
);

const month = calls.filter((c) => new Date(c.created_at) >= monthStart);
const azureSpent = (allAzure ?? []).reduce((t, c) => t + c.cost_micros, 0);
const speechChars = sum(
  month.filter(
    (c) => c.operation === "speech" && c.provider.startsWith("azure-"),
  ),
  (c) => c.chars,
);
console.log(`\n## This month\n`);
console.log(`- Spend: ${usd(sum(month, (c) => c.cost_micros))}`);
console.log(
  `- Azure credit left: about US$${(CREDIT_USD - azureSpent / 1e6).toFixed(2)} of US$${CREDIT_USD} (ends 2027-11-04)`,
);
console.log(
  `- Azure Speech: ${speechChars} / ${F0_CHARS} free characters (${((speechChars / F0_CHARS) * 100).toFixed(1)}%)`,
);

// Practices made in the period, with their calls (approximate: the log
// has no practice id). Writing, splitting, and translating happen before
// a practice is saved, so they go to the owner's next practice; notes and
// audio come after, so they go to the owner's latest practice before them.
const { data: practices } = await admin
  .from("practices")
  .select("id, title, user_id, created_at")
  .gte("created_at", since.toISOString())
  .order("created_at");
console.log(`\n## Per material (${practices?.length ?? 0}, approximate)\n`);
if (practices?.length) {
  const BEFORE_SAVE = new Set(["compose", "segment", "translate"]);
  const owned = new Map<string, Call[]>();
  for (const call of period) {
    const own = practices.filter((p) => p.user_id === call.user_id);
    const t = call.created_at;
    const target = BEFORE_SAVE.has(call.operation)
      ? own.find((p) => p.created_at >= t)
      : [...own].reverse().find((p) => p.created_at <= t);
    if (target) owned.set(target.id, [...(owned.get(target.id) ?? []), call]);
  }
  console.log("| title | calls | tokens in / out | chars | cost |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const p of practices) {
    const list = owned.get(p.id) ?? [];
    console.log(
      `| ${p.title} | ${list.length} | ${sum(list, (c) => c.input_tokens)} / ${sum(list, (c) => c.output_tokens)} | ${sum(list, (c) => c.chars)} | ${usd(sum(list, (c) => c.cost_micros))} |`,
    );
  }
}
