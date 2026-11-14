-- Price experiments and the price sensitivity survey (D174). Still a fake
-- door: nothing is charged. Only the server (service_role) reads and
-- writes these; RLS is on with no policies for anyone else.

-- An admin's experiment: one paid plan, 2–4 monthly prices (variants
-- [{ key, monthly }], "a" the control). One may run at a time.
create table public.price_experiments (
  id uuid primary key default gen_random_uuid(),
  plan text not null check (plan in ('plus', 'pro', 'student')),
  variants jsonb not null check (jsonb_typeof(variants) = 'array'),
  status text not null default 'running' check (status in ('running', 'ended')),
  winner text,
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index price_experiments_one_running
  on public.price_experiments ((true)) where status = 'running';
alter table public.price_experiments enable row level security;

-- A price an admin applied (the winner of an experiment), replacing the
-- code's default monthly price for that plan (lib/payments/pricing.ts).
create table public.price_overrides (
  plan text primary key check (plan in ('plus', 'pro', 'student')),
  monthly integer not null check (monthly between 1 and 10000),
  experiment_id uuid references public.price_experiments (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.price_overrides enable row level security;

-- Each funnel step remembers the experiment and variant shown.
alter table public.intent_events
  add column experiment_id uuid references public.price_experiments (id) on delete set null,
  add column variant text check (char_length(variant) <= 4);
create index intent_events_experiment on public.intent_events (experiment_id)
  where experiment_id is not null;

-- The waiting list remembers the price the person saw, for the early-bird
-- offer when paying opens.
alter table public.waitlist
  add column seen_amount integer check (seen_amount between 0 and 100000),
  add column seen_currency text check (char_length(seen_currency) = 3),
  add column seen_experiment_id uuid references public.price_experiments (id) on delete set null,
  add column seen_variant text check (char_length(seen_variant) <= 4);

-- Van Westendorp answers, NT$ a month. One per account, or per browser
-- when signed out; deleted with the account.
create table public.price_survey_responses (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  visitor_id text check (char_length(visitor_id) <= 64),
  context text not null check (context in ('day7', 'pricing')),
  too_cheap integer not null check (too_cheap between 0 and 5000),
  bargain integer not null check (bargain between 0 and 5000),
  expensive integer not null check (expensive between 0 and 5000),
  too_expensive integer not null check (too_expensive between 0 and 5000),
  created_at timestamptz not null default now(),
  check (user_id is not null or visitor_id is not null),
  check (too_cheap <= bargain and bargain <= expensive and expensive <= too_expensive)
);
create unique index price_survey_one_per_user
  on public.price_survey_responses (user_id) where user_id is not null;
create unique index price_survey_one_per_visitor
  on public.price_survey_responses (visitor_id) where user_id is null;
alter table public.price_survey_responses enable row level security;

-- Rollback:
--   drop table public.price_survey_responses;
--   alter table public.waitlist drop column seen_amount, drop column seen_currency,
--     drop column seen_experiment_id, drop column seen_variant;
--   drop index public.intent_events_experiment;
--   alter table public.intent_events drop column experiment_id, drop column variant;
--   drop table public.price_overrides;
--   drop table public.price_experiments;
