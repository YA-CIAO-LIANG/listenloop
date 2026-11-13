#!/usr/bin/env bash
# The backup-and-restore drill (D157), on this machine only, with a
# throwaway PostgreSQL: no production data, no network.
#
#   brew install postgresql@17   # once
#   bash scripts/restore-drill.sh
#
# 1. Starts PostgreSQL in .local/pgdrill, makes a "production" database
#    from every migration (with a small Supabase stand-in) and sample rows.
# 2. Backs it up the way .github/workflows/backup.yml does (schema and
#    data as SQL, then scripts/backup-encrypt.sh).
# 3. Restores the encrypted file into a new, empty database the way
#    docs/backup.md says (decrypt, schema, data with triggers off).
# 4. Compares every table's row count, and prints how long each step took.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
work="$root/.local/pgdrill"
port="${DRILL_PORT:-54331}"
export PGHOST=localhost PGPORT="$port" PGUSER=postgres
export BACKUP_PASSPHRASE="drill-only-passphrase-$(date +%s)-not-a-secret"

step_start=0
step() { step_start=$(date +%s); echo; echo "== $1"; }
took() { echo "   took $(($(date +%s) - step_start)) s"; }

if [ -f "$work/data/postmaster.pid" ]; then
  "$bin/pg_ctl" -D "$work/data" stop -m fast >/dev/null 2>&1 || true
fi
mkdir -p "$work"
find "$work" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +

step "Start a throwaway PostgreSQL on port $port"
"$bin/initdb" -D "$work/data" -U postgres -A trust >/dev/null
"$bin/pg_ctl" -D "$work/data" -o "-p $port -k $work" -l "$work/pg.log" start >/dev/null
trap '"$bin/pg_ctl" -D "$work/data" stop -m fast >/dev/null 2>&1 || true' EXIT
took

step "Make the source database: Supabase stand-in, every migration, sample rows"
"$bin/createdb" source
psql_q() { "$bin/psql" -q -v ON_ERROR_STOP=1 "$@"; }
psql_q -d source -f "$root/scripts/drill/supabase-shim.sql" >/dev/null
count=0
for migration in "$root"/supabase/migrations/*.sql; do
  psql_q -d source -f "$migration" >/dev/null
  count=$((count + 1))
done
echo "   $count migrations applied"
psql_q -d source >/dev/null <<'SQL'
insert into auth.users (id, email)
select gen_random_uuid(), 'drill' || n || '@example.com'
from generate_series(1, 200) n;
insert into public.progress (user_id, video_id, data)
select u.id, 'sintel', jsonb_build_object('week', 1)
from auth.users u;
insert into public.events (user_id, type, video_id)
select u.id, 'practice_start', 'sintel'
from auth.users u, generate_series(1, 20);
insert into public.practices (id, user_id, title, source_language)
select gen_random_uuid(), u.id, 'Drill practice', 'en'
from auth.users u;
insert into public.practice_sentences (practice_id, i, en, zh)
select p.id, n, 'Sentence ' || n || '.', '句子 ' || n
from public.practices p, generate_series(0, 9) n;
SQL
took

step "Back up like the workflow: schema and data as SQL, then encrypt"
mkdir -p "$work/backup"
# The workflow uses `supabase db dump`, which runs pg_dump the same way:
# the app's schema, then the data of public, auth, and storage.
"$bin/pg_dump" -d source --schema-only --no-owner --no-privileges -n public \
  -f "$work/backup/schema.sql"
"$bin/pg_dump" -d source --data-only --no-owner -n public -n auth -n storage \
  -f "$work/backup/data.sql"
bash "$root/scripts/backup-encrypt.sh" "$work/backup" "$work/listenloop-backup.tar.gz.enc"
took

step "Restore like docs/backup.md: decrypt, schema, then data with triggers off"
bash "$root/scripts/backup-decrypt.sh" "$work/listenloop-backup.tar.gz.enc" "$work/restored" >/dev/null
"$bin/createdb" restored
# A new Supabase project already has the roles, auth, and storage.
psql_q -d restored -f "$root/scripts/drill/supabase-shim.sql" >/dev/null
psql_q -d restored -c "drop schema public cascade" >/dev/null
psql_q -d restored -f "$work/restored/schema.sql" >/dev/null
psql_q -d restored >/dev/null <<SQL
set session_replication_role = replica;
\\i $work/restored/data.sql
SQL
took

step "Compare every table's rows"
counts() {
  "$bin/psql" -At -d "$1" -c "
    select string_agg(format('%s=%s', relname, n), ' ' order by relname)
    from (
      select c.relname,
        (xpath('/row/n/text()', query_to_xml(
          format('select count(*) as n from %I.%I', n.nspname, c.relname),
          false, true, '')))[1]::text::bigint as n
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname in ('public', 'auth', 'storage')
    ) t"
}
before="$(counts source)"
after="$(counts restored)"
tables=$(echo "$before" | wc -w | tr -d ' ')
if [ "$before" = "$after" ]; then
  echo "   all $tables tables match"
else
  echo "   MISMATCH"
  diff <(echo "$before" | tr ' ' '\n') <(echo "$after" | tr ' ' '\n') || true
  exit 1
fi
policies_source=$("$bin/psql" -At -d source -c "select count(*) from pg_policies")
policies_restored=$("$bin/psql" -At -d restored -c "select count(*) from pg_policies")
echo "   row level security policies: $policies_source → $policies_restored"
[ "$policies_source" = "$policies_restored" ]
took
echo
echo "Drill passed."
