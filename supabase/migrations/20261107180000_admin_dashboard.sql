-- The admin dashboard (D56).

-- 1. Every admin change, for the audit page: who, when, on what, and what
-- changed (before and after values, never secrets). Server-written.
create table public.admin_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target_type text not null check (target_type in ('user', 'practice', 'report', 'setting')),
  target_id text not null check (char_length(target_id) between 1 and 80),
  changes jsonb not null default '{}'::jsonb
    check (octet_length(changes::text) <= 4000)
);

create index admin_audit_created_at on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;

create policy "Admins read the audit log" on public.admin_audit
for select to authenticated
using ((select public.is_admin()));

grant select on public.admin_audit to authenticated;
grant all on public.admin_audit to service_role;

-- 2. The overview's numbers in one call (service_role only).
create function public.admin_overview(
  day_start timestamptz,
  week_start timestamptz
) returns table (
  users bigint,
  active_today bigint,
  active_week bigint,
  new_users_week bigint,
  new_practices_week bigint,
  days_completed_week bigint,
  database_bytes bigint,
  storage_bytes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles),
    (select count(distinct user_id) from public.events
      where created_at >= day_start and user_id is not null),
    (select count(distinct user_id) from public.events
      where created_at >= week_start and user_id is not null),
    (select count(*) from public.profiles where created_at >= week_start),
    (select count(*) from public.practices where created_at >= week_start),
    (select count(*) from public.events
      where type = 'day_complete' and created_at >= week_start),
    pg_database_size(current_database()),
    (select coalesce(sum((metadata ->> 'size')::bigint), 0)::bigint
      from storage.objects);
$$;

revoke all on function public.admin_overview(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_overview(timestamptz, timestamptz) to service_role;

-- 3. The user list: profile, practices made, and this month's API cost.
create function public.admin_users(month_start timestamptz)
returns table (
  user_id uuid,
  number bigint,
  role text,
  status text,
  created_at timestamptz,
  last_seen_at timestamptz,
  practices bigint,
  month_micros bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id, p.number, p.role, p.status, p.created_at, p.last_seen_at,
    (select count(*) from public.practices pr where pr.user_id = p.user_id),
    (select coalesce(sum(c.cost_micros), 0)::bigint from public.api_calls c
      where c.user_id = p.user_id and c.created_at >= month_start)
  from public.profiles p
  order by p.number;
$$;

revoke all on function public.admin_users(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_users(timestamptz) to service_role;

-- 4. Keep the API call log: it's the running total against the Azure
-- credit (D38). Retention applies to activity and hard-sentence reports.
create or replace function public.prune_logs() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.events where created_at < now() - interval '180 days';
  delete from public.shadowing_issues where created_at < now() - interval '365 days';
  delete from public.admin_audit where created_at < now() - interval '730 days';
$$;
