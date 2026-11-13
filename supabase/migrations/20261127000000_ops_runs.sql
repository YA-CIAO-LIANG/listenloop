-- Monitor runs started from the public health check (D163). Once the repo
-- is private, GitHub Actions only checks every 6 hours; UptimeRobot loads
-- /api/health every 5 minutes, and the site starts its own monitor from
-- there at most once per gap. claim_ops_run is the lock: only one caller
-- gets `true` per gap, however many health checks arrive at once.
create table public.ops_runs (
  name text primary key,
  last_at timestamptz not null default now()
);

alter table public.ops_runs enable row level security;
-- No policies: only the secret key (service_role) reads or writes.

create or replace function public.claim_ops_run(run_name text, gap_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.ops_runs as r (name, last_at)
  values (run_name, now())
  on conflict (name) do update
    set last_at = now()
    where r.last_at < now() - make_interval(secs => gap_seconds)
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_ops_run(text, integer) from public, anon, authenticated;
grant execute on function public.claim_ops_run(text, integer) to service_role;

-- Rollback:
--   drop function public.claim_ops_run(text, integer);
--   drop table public.ops_runs;
