-- Abuse protection and error monitoring (P1, D63).

-- 1. Rate limits: hits per key per fixed window. The key names the action
--    and who did it: an account id, or a hash of the IP address for
--    signed-out requests (never the address itself). One statement counts
--    and checks, so concurrent requests can't slip past the limit.
create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
grant all on public.rate_limits to service_role;

create function public.hit_rate_limit(
  limit_key text,
  window_seconds integer,
  max_hits integer
) returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, hits)
  values (
    limit_key,
    to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds),
    1
  )
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits <= max_hits;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- 2. Server errors for the admin dashboard: what failed and where, a
--    digest to match the error page, never request bodies or personal
--    data. Server-written; admins read.
create table public.error_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  digest text check (char_length(digest) <= 100),
  message text not null check (char_length(message) <= 1000),
  path text check (char_length(path) <= 300),
  method text check (char_length(method) <= 10),
  route_type text check (char_length(route_type) <= 40),
  stack text check (char_length(stack) <= 4000)
);

create index error_logs_created_at on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

create policy "Admins read errors" on public.error_logs
for select to authenticated
using ((select public.is_admin()));

grant select on public.error_logs to authenticated;
grant all on public.error_logs to service_role;

-- Retention (D55, D63): rate-limit windows a day, server errors 90 days.
create or replace function public.prune_logs() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.events where created_at < now() - interval '180 days';
  delete from public.shadowing_issues where created_at < now() - interval '365 days';
  delete from public.admin_audit where created_at < now() - interval '730 days';
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.error_logs where created_at < now() - interval '90 days';
$$;
