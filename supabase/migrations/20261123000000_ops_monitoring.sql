-- Monitoring, alerts, capacity samples, and weekly summaries (D156).
-- Additive only. Only the server (service_role) writes these; admins
-- read alerts and weekly summaries on the dashboard.

-- Every alert the monitor raised, sent or not (no personal data).
create table public.ops_alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  key text not null check (char_length(key) between 1 and 100),
  level text not null check (level in ('warning', 'critical')),
  message text not null check (char_length(message) between 1 and 500),
  notified boolean not null default false
);
create index ops_alerts_key_created_at on public.ops_alerts (key, created_at desc);
create index ops_alerts_created_at on public.ops_alerts (created_at desc);

-- The monitor's health checks, for the status page.
create table public.health_checks (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'degraded', 'down')),
  checks jsonb not null default '{}'::jsonb
);
create index health_checks_checked_at on public.health_checks (checked_at desc);

-- One sample a day of Supabase's database and storage size (forecasts).
create table public.ops_samples (
  day date primary key,
  database_bytes bigint not null check (database_bytes >= 0),
  storage_bytes bigint not null check (storage_bytes >= 0)
);

-- The weekly usage and cost summary.
create table public.weekly_reports (
  week_start date primary key,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ops_alerts enable row level security;
alter table public.health_checks enable row level security;
alter table public.ops_samples enable row level security;
alter table public.weekly_reports enable row level security;

create policy "Admins read alerts" on public.ops_alerts
for select to authenticated using ((select public.is_admin()));
create policy "Admins read weekly reports" on public.weekly_reports
for select to authenticated using ((select public.is_admin()));

revoke all on public.ops_alerts, public.health_checks, public.ops_samples,
  public.weekly_reports from anon, authenticated;
grant select on public.ops_alerts, public.weekly_reports to authenticated;
grant all on public.ops_alerts, public.health_checks, public.ops_samples,
  public.weekly_reports to service_role;

-- The monitor's numbers in one call (no personal data): server errors,
-- spend today and on each of the 7 days before, the month's spend and
-- Azure speech characters, Supabase's sizes, sign-ups and reports in
-- the last hour.
create function public.ops_snapshot(day_start timestamptz, month_start timestamptz)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'errors_15m', (select count(*) from public.error_logs
      where created_at >= now() - interval '15 minutes'),
    'errors_7d', (select count(*) from public.error_logs
      where created_at >= now() - interval '7 days'
        and created_at < now() - interval '15 minutes'),
    'today_micros', (select coalesce(sum(cost_micros), 0) from public.api_calls
      where created_at >= day_start),
    'previous_days', (
      select coalesce(json_agg(coalesce(x.micros, 0) order by g), '[]'::json)
      from generate_series(
        day_start - interval '7 days',
        day_start - interval '1 day',
        interval '1 day'
      ) g
      left join lateral (
        select sum(cost_micros) as micros from public.api_calls
        where created_at >= g and created_at < g + interval '1 day'
      ) x on true
    ),
    'month_micros', (select coalesce(sum(cost_micros), 0) from public.api_calls
      where created_at >= month_start),
    'speech_chars_month', (select coalesce(sum(chars), 0) from public.api_calls
      where created_at >= month_start
        and operation = 'speech' and provider like 'azure-%'),
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0)
      from storage.objects),
    'signups_1h', (select count(*) from public.profiles
      where created_at >= now() - interval '1 hour'),
    'reports_1h', (select count(*) from public.practice_reports
        where created_at >= now() - interval '1 hour')
      + (select count(*) from public.sentence_reports
        where created_at >= now() - interval '1 hour')
  );
$$;
revoke all on function public.ops_snapshot(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.ops_snapshot(timestamptz, timestamptz)
  to service_role;

-- Spend on each of the last `days` days (Taiwan days), for the forecast.
create function public.daily_api_cost(day_start timestamptz, days integer)
returns table (day date, micros bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (g at time zone 'Asia/Taipei')::date,
    coalesce((select sum(cost_micros) from public.api_calls
      where created_at >= g and created_at < g + interval '1 day'), 0)::bigint
  from generate_series(
    day_start - make_interval(days => days),
    day_start - interval '1 day',
    interval '1 day'
  ) g
  order by g;
$$;
revoke all on function public.daily_api_cost(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.daily_api_cost(timestamptz, integer)
  to service_role;

-- A week's numbers for the summary: spend by provider and operation,
-- new accounts and practices, active learners (counts only).
create function public.weekly_numbers(week_start timestamptz, week_end timestamptz)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'by_operation', (
      select coalesce(json_agg(row_to_json(t) order by t.micros desc), '[]'::json)
      from (
        select provider, operation, count(*) as calls,
          coalesce(sum(cost_micros), 0) as micros
        from public.api_calls
        where created_at >= week_start and created_at < week_end
        group by provider, operation
      ) t
    ),
    'new_users', (select count(*) from public.profiles
      where created_at >= week_start and created_at < week_end),
    'new_practices', (select count(*) from public.practices
      where created_at >= week_start and created_at < week_end),
    'active_users', (select count(distinct user_id) from public.events
      where created_at >= week_start and created_at < week_end
        and user_id is not null),
    'azure_micros', (select coalesce(sum(cost_micros), 0) from public.api_calls
      where provider like 'azure-%')
  );
$$;
revoke all on function public.weekly_numbers(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.weekly_numbers(timestamptz, timestamptz)
  to service_role;

-- Retention (D55, D63, D156): as before, plus alerts 90 days and health
-- checks 30 days. Now also run daily by the monitor.
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
  delete from public.ops_alerts where created_at < now() - interval '90 days';
  delete from public.health_checks where checked_at < now() - interval '30 days';
$$;

-- Rollback:
--   Restore prune_logs from 20261108090000_rate_limits_error_logs.sql, then
--   drop function public.weekly_numbers(timestamptz, timestamptz);
--   drop function public.daily_api_cost(timestamptz, integer);
--   drop function public.ops_snapshot(timestamptz, timestamptz);
--   drop table public.weekly_reports, public.ops_samples,
--     public.health_checks, public.ops_alerts;
