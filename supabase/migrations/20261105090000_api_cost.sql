-- Estimated cost of language-model work per user and day (Taiwan time,
-- D38), in micro-dollars (US$0.000001). Written only by the server
-- through reserve_api_cost and settle_api_cost.
create table public.api_daily_cost (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  micros bigint not null default 0 check (micros >= 0),
  primary key (user_id, day)
);

-- One row per paid-API call, for /admin/usage. Counts only, never the
-- text sent. Kept when the account is deleted (user_id becomes null), so
-- the running total against the Azure credit stays right.
create table public.api_calls (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  provider text not null check (char_length(provider) between 1 and 100),
  operation text not null check (char_length(operation) between 1 and 40),
  error text check (char_length(error) between 1 and 40),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  chars integer not null default 0 check (chars >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0)
);

create index api_calls_created_at on public.api_calls (created_at desc);
create index api_calls_user_id on public.api_calls (user_id);

alter table public.api_daily_cost enable row level security;
alter table public.api_calls enable row level security;

-- Server only (the secret key bypasses RLS); no policies for users.
revoke all on public.api_daily_cost, public.api_calls from anon, authenticated;

-- Adds `amount` micro-dollars to the day's cost only if the total stays
-- within `max_micros`, in one statement, like reserve_api_usage.
create function public.reserve_api_cost(
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
  insert into public.api_daily_cost as c (user_id, day, micros)
  select target_user, usage_day, amount
  where amount <= max_micros
  on conflict (user_id, day) do update
    set micros = c.micros + excluded.micros
    where c.micros + excluded.micros <= max_micros
  returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

-- Adjusts the day's cost by `delta` (negative gives back what a call
-- didn't use), never below zero.
create function public.settle_api_cost(
  target_user uuid,
  usage_day date,
  delta bigint
) returns void
language sql
set search_path = ''
as $$
  insert into public.api_daily_cost as c (user_id, day, micros)
  values (target_user, usage_day, greatest(delta, 0))
  on conflict (user_id, day) do update
    set micros = greatest(c.micros + delta, 0);
$$;

revoke execute on function public.reserve_api_cost, public.settle_api_cost
  from public, anon, authenticated;
grant execute on function public.reserve_api_cost, public.settle_api_cost
  to service_role;
