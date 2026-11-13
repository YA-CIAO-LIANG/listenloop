-- Abuse detection and fair queueing (D162). Additive (queue_position is
-- replaced with a fairer order; its arguments are unchanged).

-- Where each new account signed up from: the IP hashed, never the
-- address. Kept 90 days (prune_logs). Server only.
create table public.account_signals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ip_hash text not null check (char_length(ip_hash) between 8 and 64),
  created_at timestamptz not null default now()
);
create index account_signals_ip on public.account_signals (ip_hash, created_at);
alter table public.account_signals enable row level security;
revoke all on public.account_signals from anon, authenticated;
grant all on public.account_signals to service_role;

-- What the detector found. One open flag per account and kind.
create table public.abuse_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('multi-signup', 'heavy-use', 'capped-days', 'reported')),
  detail jsonb not null default '{}'::jsonb,
  auto_suspended boolean not null default false,
  status text not null default 'open' check (status in ('open', 'confirmed', 'dismissed')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create unique index abuse_flags_one_open on public.abuse_flags (user_id, kind)
  where status = 'open';
create index abuse_flags_created_at on public.abuse_flags (created_at desc);
alter table public.abuse_flags enable row level security;
create policy "Admins read abuse flags" on public.abuse_flags
for select to authenticated using ((select public.is_admin()));
revoke all on public.abuse_flags from anon, authenticated;
grant select on public.abuse_flags to authenticated;
grant all on public.abuse_flags to service_role;

-- The detector's numbers (counts only):
-- - signups: IP hashes with 3+ new accounts in 24 hours, and who;
-- - heavy: accounts with many language-model calls in the last hour;
-- - days: each account's spend on each of the last 3 Taiwan days;
-- - reported: accounts whose public practices 3+ different people
--   reported in 30 days.
create function public.abuse_signals(day_start timestamptz, heavy_calls integer)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'signups', (
      select coalesce(json_agg(json_build_object('ip', ip_hash, 'users', users)), '[]'::json)
      from (
        select ip_hash, json_agg(user_id) as users
        from public.account_signals
        where created_at >= now() - interval '24 hours'
        group by ip_hash
        having count(*) >= 3
      ) s
    ),
    'heavy', (
      select coalesce(json_agg(json_build_object('user', user_id, 'calls', calls)), '[]'::json)
      from (
        select user_id, count(*) as calls
        from public.api_calls
        where created_at >= now() - interval '1 hour'
          and user_id is not null
          and operation not in ('speech', 'transcribe')
        group by user_id
        having count(*) >= heavy_calls
      ) h
    ),
    'days', (
      select coalesce(json_agg(json_build_object('user', d.user_id, 'day', d.day, 'micros', d.micros)), '[]'::json)
      from public.api_daily_cost d
      where d.day >= ((day_start at time zone 'Asia/Taipei')::date - 2)
    ),
    'reported', (
      select coalesce(json_agg(json_build_object('user', user_id, 'reporters', reporters)), '[]'::json)
      from (
        select p.user_id, count(distinct r.reporter_id) as reporters
        from public.practice_reports r
        join public.practices p on p.id = r.practice_id
        where r.created_at >= now() - interval '30 days'
        group by p.user_id
        having count(distinct r.reporter_id) >= 3
      ) x
    )
  );
$$;
revoke all on function public.abuse_signals(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.abuse_signals(timestamptz, integer)
  to service_role;

-- Fair priority (D162): each level of priority counts as having joined
-- 180 seconds earlier (lib/queue.ts headStartSeconds), so the first in
-- line is the one whose (joined - priority × 180 s) is earliest. A free
-- job waiting over 6 minutes goes before a Pro job that just arrived.
create or replace function public.queue_position(
  target_resource text,
  target_ticket text,
  target_user uuid,
  target_priority integer,
  stale_seconds integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine public.work_queue;
  mine_key timestamptz;
  ahead integer;
begin
  delete from public.work_queue
  where resource = target_resource
    and seen_at < now() - make_interval(secs => stale_seconds);
  insert into public.work_queue (ticket, resource, user_id, priority)
  values (target_ticket, target_resource, target_user, target_priority)
  on conflict (ticket) do update set seen_at = now()
  returning * into mine;
  mine_key := mine.enqueued_at - make_interval(secs => mine.priority * 180);
  select count(*) into ahead from public.work_queue q
  where q.resource = target_resource
    and q.ticket <> mine.ticket
    and (
      q.enqueued_at - make_interval(secs => q.priority * 180) < mine_key
      or (
        q.enqueued_at - make_interval(secs => q.priority * 180) = mine_key
        and q.ticket < mine.ticket
      )
    );
  return ahead;
end;
$$;

-- Retention: sign-up signals 90 days (D159, D162).
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
  delete from public.beta_waitlist where created_at < now() - interval '365 days';
  delete from public.intent_events where created_at < now() - interval '365 days';
  delete from public.account_signals where created_at < now() - interval '90 days';
$$;

-- Rollback:
--   Restore queue_position from 20261116000000_work_queue.sql and
--   prune_logs from 20261124000000_personal_data_retention.sql, then
--   drop function public.abuse_signals(timestamptz, integer);
--   drop table public.abuse_flags, public.account_signals;
