-- Payments (D85): subscriptions, payments, and the payment provider's
-- webhook events, kept so each event is applied once (idempotency).
-- Only the server writes these (the webhook and admins, with the secret
-- key); people read their own subscription and payments for the account
-- page. profiles.plan stays the one place that says what an account may
-- do (D72); the webhook keeps it in step with the subscription.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  provider_subscription_id text not null unique
    check (char_length(provider_subscription_id) between 1 and 200),
  status text not null check (status in ('active', 'past_due', 'expired')),
  billing_interval text not null check (billing_interval in ('month', 'year')),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  -- Made by the fake provider (development, tests): never real money.
  test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Read own subscription" on public.subscriptions
for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  provider_payment_id text not null unique
    check (char_length(provider_payment_id) between 1 and 200),
  -- In the currency's smallest unit (NT$1 = 1; US$1 = 100).
  amount integer not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('paid', 'refunded')),
  billing_interval text check (billing_interval in ('month', 'year')),
  test boolean not null default false,
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);

create index payments_user_created on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

create policy "Read own payments" on public.payments
for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.payments to authenticated;
grant all on public.payments to service_role;

-- Every webhook event received, by the provider's event id: a repeat of
-- one already applied is acknowledged and skipped. Server only.
create table public.payment_events (
  provider text not null,
  event_id text not null check (char_length(event_id) between 1 and 200),
  type text not null check (char_length(type) between 1 and 80),
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant all on public.payment_events to service_role;
