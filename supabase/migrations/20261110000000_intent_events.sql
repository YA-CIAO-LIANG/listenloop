-- Interest in paid features (D93, P2 fake doors): each step someone takes
-- toward paying — seeing the pricing page, switching the billing period,
-- pressing "subscribe" or "unlock", joining the waiting list — with the
-- plan, period, item, and the page that sent them. Nobody is charged.
-- `visitor_id` is a random id in a first-party cookie, so steps by the
-- same (signed-out) visitor can be counted once; `user_id` when signed in.
-- Only the server writes and reads it (the secret key); no public access.
create table public.intent_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  visitor_id text not null check (char_length(visitor_id) between 8 and 64),
  step text not null check (
    step in (
      'pricing_view',
      'interval_switch',
      'subscribe_click',
      'waitlist_join',
      'unlock_click'
    )
  ),
  plan text check (char_length(plan) <= 32),
  billing_interval text check (char_length(billing_interval) <= 16),
  item text check (char_length(item) <= 32),
  source text check (char_length(source) <= 32)
);

create index intent_events_created_at on public.intent_events (created_at);

alter table public.intent_events enable row level security;

grant all on public.intent_events to service_role;
