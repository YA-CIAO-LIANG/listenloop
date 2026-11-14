-- Referral program (D177). Additive: three new tables, one function, and
-- the abuse detector (D162) learns one more kind of flag.
--
-- Each account gets its own code (/r/<code>). A friend who signs up
-- through it is recorded as a referral; when the friend finishes Day 1
-- (checked on the server from their cloud progress), both accounts get
-- bonus minutes for making their own practices (lib/referral.ts).

-- One code per account, made the first time it's shown.
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
create policy "Read own referral code" on public.referral_codes
for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.referral_codes from anon, authenticated;
grant select on public.referral_codes to authenticated;
grant all on public.referral_codes to service_role;

-- Who brought whom. A friend can be referred once. When the friend's
-- account is deleted the row stays without them, so the referrer keeps
-- what they earned and deleting can't be used to refer the same person
-- again.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referee_id uuid unique references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'rejected', 'expired')),
  reason text check (reason in ('self', 'same-ip', 'same-device', 'burst')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (referrer_id <> referee_id)
);
create index referrals_referrer on public.referrals (referrer_id, created_at);
create index referrals_pending on public.referrals (created_at)
  where status = 'pending';
alter table public.referrals enable row level security;
-- Each side reads the rows they're in; only the server writes.
create policy "Read own referrals" on public.referrals
for select to authenticated
using (
  referrer_id = (select auth.uid()) or referee_id = (select auth.uid())
);
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;

-- Bonus minutes each account earned: a one-time pool on top of the
-- plan's weekly or monthly minutes, each grant usable until it expires.
create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('referrer', 'referee')),
  minutes integer not null check (minutes between 1 and 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (referral_id, user_id)
);
create index referral_rewards_user on public.referral_rewards (user_id, expires_at);
alter table public.referral_rewards enable row level security;
create policy "Read own referral rewards" on public.referral_rewards
for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.referral_rewards from anon, authenticated;
grant select on public.referral_rewards to authenticated;
grant all on public.referral_rewards to service_role;

-- Marks a pending referral qualified and grants both rewards in one
-- transaction; false when it was already settled (so nothing is granted
-- twice). A minutes value of 0 grants nothing to that side (the
-- referrer's monthly cap).
create function public.qualify_referral(
  target uuid,
  referrer_minutes integer,
  referee_minutes integer,
  valid_days integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.referrals;
begin
  update public.referrals
  set status = 'qualified', settled_at = now()
  where id = target and status = 'pending'
  returning * into r;
  if not found then
    return false;
  end if;
  if referee_minutes > 0 and r.referee_id is not null then
    insert into public.referral_rewards (referral_id, user_id, role, minutes, expires_at)
    values (r.id, r.referee_id, 'referee', referee_minutes,
      now() + make_interval(days => valid_days))
    on conflict (referral_id, user_id) do nothing;
  end if;
  if referrer_minutes > 0 then
    insert into public.referral_rewards (referral_id, user_id, role, minutes, expires_at)
    values (r.id, r.referrer_id, 'referrer', referrer_minutes,
      now() + make_interval(days => valid_days))
    on conflict (referral_id, user_id) do nothing;
  end if;
  return true;
end;
$$;
revoke all on function public.qualify_referral(uuid, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.qualify_referral(uuid, integer, integer, integer)
  to service_role;

-- The abuse detector's new kind: a referrer whose friends look like the
-- same person (lib/ops/abuse.ts).
alter table public.abuse_flags drop constraint abuse_flags_kind_check;
alter table public.abuse_flags add constraint abuse_flags_kind_check
  check (kind in ('multi-signup', 'heavy-use', 'capped-days', 'reported', 'referral-farm'));

-- abuse_signals (D162) with one more list:
-- - referrals: referrers with referrals turned down in 30 days, or with
--   many sign-ups through their link in 24 hours.
create or replace function public.abuse_signals(day_start timestamptz, heavy_calls integer)
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
    ),
    'referrals', (
      select coalesce(json_agg(json_build_object('user', referrer_id, 'rejected', rejected, 'day', day)), '[]'::json)
      from (
        select referrer_id,
          count(*) filter (where status = 'rejected') as rejected,
          count(*) filter (where created_at >= now() - interval '24 hours') as day
        from public.referrals
        where created_at >= now() - interval '30 days'
        group by referrer_id
        having count(*) filter (where status = 'rejected') >= 2
          or count(*) filter (where created_at >= now() - interval '24 hours') >= 3
      ) f
    )
  );
$$;
revoke all on function public.abuse_signals(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.abuse_signals(timestamptz, integer)
  to service_role;

-- Rollback:
--   (restore abuse_signals from 20261126000000_abuse_and_queue.sql)
--   delete from public.abuse_flags where kind = 'referral-farm';
--   alter table public.abuse_flags drop constraint abuse_flags_kind_check;
--   alter table public.abuse_flags add constraint abuse_flags_kind_check
--     check (kind in ('multi-signup', 'heavy-use', 'capped-days', 'reported'));
--   drop function public.qualify_referral(uuid, integer, integer, integer);
--   drop table public.referral_rewards;
--   drop table public.referrals;
--   drop table public.referral_codes;
