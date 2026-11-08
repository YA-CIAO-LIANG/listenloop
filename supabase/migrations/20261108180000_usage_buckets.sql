-- AI cost limits by kind of work (D77): batch jobs (upgrading official
-- notes, writing subtitles) count apart from what admins and learners
-- create by hand, so a batch can't use up the day's manual allowance.
-- The limits themselves live in usage_settings, editable by admins, with
-- a site-wide monthly cap that protects the Azure student credit.

-- One row of limits, in micro-dollars (US$0.000001). Server only.
create table public.usage_settings (
  id integer primary key default 1 check (id = 1),
  admin_manual_micros bigint not null default 1000000 check (admin_manual_micros >= 0),
  admin_batch_micros bigint not null default 1000000 check (admin_batch_micros >= 0),
  paid_micros bigint not null default 200000 check (paid_micros >= 0),
  free_micros bigint not null default 50000 check (free_micros >= 0),
  site_monthly_micros bigint not null default 8000000 check (site_monthly_micros >= 0),
  updated_at timestamptz not null default now()
);

insert into public.usage_settings (id) values (1) on conflict do nothing;

alter table public.usage_settings enable row level security;
revoke all on public.usage_settings from anon, authenticated;
grant all on public.usage_settings to service_role;

-- Batch jobs' cost per user and day (Taiwan time), like api_daily_cost.
create table public.api_batch_cost (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  micros bigint not null default 0 check (micros >= 0),
  primary key (user_id, day)
);

alter table public.api_batch_cost enable row level security;
revoke all on public.api_batch_cost from anon, authenticated;
grant all on public.api_batch_cost to service_role;

create function public.reserve_api_batch_cost(
  target_user uuid,
  usage_day date,
  amount bigint,
  max_micros bigint
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  reserved boolean;
begin
  if amount < 0 then
    raise exception 'amount must not be negative';
  end if;
  insert into public.api_batch_cost as c (user_id, day, micros)
  select target_user, usage_day, amount
  where amount <= max_micros
  on conflict (user_id, day) do update
    set micros = c.micros + excluded.micros
    where c.micros + excluded.micros <= max_micros
  returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

create function public.settle_api_batch_cost(
  target_user uuid,
  usage_day date,
  delta bigint
) returns void
language sql
set search_path = ''
as $$
  insert into public.api_batch_cost as c (user_id, day, micros)
  values (target_user, usage_day, greatest(delta, 0))
  on conflict (user_id, day) do update
    set micros = greatest(c.micros + delta, 0);
$$;

-- What every call has cost since `month_start`, for the monthly cap.
create function public.month_api_cost(month_start timestamptz)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(cost_micros), 0)::bigint
  from public.api_calls
  where created_at >= month_start;
$$;

revoke execute on function public.reserve_api_batch_cost,
  public.settle_api_batch_cost, public.month_api_cost
  from public, anon, authenticated;
grant execute on function public.reserve_api_batch_cost,
  public.settle_api_batch_cost, public.month_api_cost to service_role;
