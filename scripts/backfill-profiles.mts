/**
 * One-off (D50): gives every existing account a profile. The first admin
 * in ADMIN_EMAILS becomes "User 000" (the owner); everyone else is
 * numbered from 001 in sign-up order, so the first real learner is 001.
 * Later accounts get their profile from the database trigger.
 *
 *   node --env-file=.env.local scripts/backfill-profiles.mts
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * ADMIN_EMAILS; prints counts only, never emails. Safe to run again:
 * accounts that already have a profile are skipped.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admins = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;
const { data: existing, error: readError } = await supabase
  .from("profiles")
  .select("user_id, number");
if (readError) throw readError;
const done = new Set(existing.map((row) => row.user_id));
const hasOwner = existing.some((row) => row.number === 0);

const users = [...data.users].sort((a, b) =>
  a.created_at.localeCompare(b.created_at),
);
const owner = hasOwner
  ? undefined
  : users.find((u) => admins.has((u.email ?? "").toLowerCase()));
let added = 0;
for (const user of [owner, ...users.filter((u) => u !== owner)]) {
  if (!user || done.has(user.id)) continue;
  const isAdmin = admins.has((user.email ?? "").toLowerCase());
  const { error: insertError } = await supabase.from("profiles").insert({
    user_id: user.id,
    created_at: user.created_at,
    role: isAdmin ? "admin" : "user",
    ...(user === owner ? { number: 0 } : {}),
  });
  if (insertError) throw insertError;
  done.add(user.id);
  added += 1;
}
console.log(`Profiles added: ${added} (of ${users.length} accounts).`);
