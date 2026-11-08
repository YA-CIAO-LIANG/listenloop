/**
 * Live row level security check (D63): with only the public (anon) key,
 * as anyone on the internet could, try to read every private table and
 * to write to the server-only ones. Every attempt must come back empty
 * or refused. Read-only for real data: writes target nothing that exists
 * and are expected to fail.
 *
 *   npm run rls:check
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}
const anon = createClient(url, key, { auth: { persistSession: false } });

const PRIVATE = [
  "profiles",
  "progress",
  "user_documents",
  "collections",
  "api_calls",
  "api_daily_cost",
  "api_usage",
  "events",
  "shadowing_issues",
  "admin_audit",
  "feedback",
  "rate_limits",
  "error_logs",
  "practice_reports",
  "ai_cache",
  "usage_settings",
  "api_batch_cost",
  "waitlist",
  // Payments (D85).
  "subscriptions",
  "payments",
  "payment_events",
  // Steps toward paying (D93).
  "intent_events",
  // Classroom (D103).
  "classes",
  "class_members",
  "assignments",
  "announcements",
];
const failures: string[] = [];

for (const table of PRIVATE) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  const ok = !!error || (data ?? []).length === 0;
  console.log(
    `${ok ? "✓" : "✗"} read ${table}: ${error ? `refused (${error.code})` : `${data?.length ?? 0} rows`}`,
  );
  if (!ok) failures.push(`read ${table}`);
}

// Practices: only public, not taken down, ones are visible.
const { data: practices } = await anon
  .from("practices")
  .select("id, visibility, removed_at, published")
  .limit(1000);
const leaked = (practices ?? []).filter(
  (p) => p.visibility !== "public" || p.removed_at !== null,
);
console.log(
  `${leaked.length ? "✗" : "✓"} practices: ${practices?.length ?? 0} visible, ${leaked.length} private or taken down`,
);
if (leaked.length) failures.push("practices");

for (const [table, row] of [
  ["events", { type: "sign_in" }],
  ["feedback", { category: "other", message: "rls check" }],
  ["error_logs", { message: "rls check" }],
  [
    "profiles",
    { user_id: "00000000-0000-0000-0000-000000000000", role: "admin" },
  ],
  // Nobody but the webhook (secret key) records a payment (D85).
  [
    "subscriptions",
    {
      user_id: "00000000-0000-0000-0000-000000000000",
      provider: "rls-check",
      provider_subscription_id: "rls-check",
      status: "active",
      billing_interval: "month",
      current_period_end: "2030-01-01T00:00:00Z",
    },
  ],
  [
    "payments",
    {
      user_id: "00000000-0000-0000-0000-000000000000",
      provider: "rls-check",
      provider_payment_id: "rls-check",
      amount: 0,
      currency: "TWD",
      status: "paid",
    },
  ],
  ["payment_events", { provider: "rls-check", event_id: "x", type: "x" }],
  ["intent_events", { visitor_id: "rls-check", step: "pricing_view" }],
  [
    "classes",
    {
      teacher_id: "00000000-0000-0000-0000-000000000000",
      name: "rls-check",
      invite_code: "RLSCHECK",
    },
  ],
] as const) {
  const { error } = await anon.from(table).insert(row as never);
  console.log(
    `${error ? "✓" : "✗"} write ${table}: ${error ? `refused (${error.code})` : "ACCEPTED"}`,
  );
  if (!error) failures.push(`write ${table}`);
}

const now = new Date().toISOString();
for (const [fn, args] of [
  ["prune_logs", {}],
  ["admin_overview", { day_start: now, week_start: now }],
  ["admin_users", { month_start: now }],
  ["api_usage_totals", { month_start: now, day_start: now }],
  [
    "hit_rate_limit",
    { limit_key: "rls-check", window_seconds: 60, max_hits: 1 },
  ],
  [
    "reserve_api_cost",
    {
      target_user: "00000000-0000-0000-0000-000000000000",
      usage_day: now.slice(0, 10),
      amount: 1,
      max_micros: 1,
    },
  ],
] as const) {
  const { error } = await anon.rpc(fn as never, args as never);
  // Permission denied (42501), not "no such function" (PGRST202).
  const ok = error?.code === "42501";
  console.log(
    `${ok ? "✓" : "✗"} call ${fn}: ${error ? `refused (${error.code})` : "ACCEPTED"}`,
  );
  if (!ok) failures.push(`call ${fn}`);
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll private tables are closed to the public key.");
