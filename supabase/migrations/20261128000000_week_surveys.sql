-- The survey after a week's Day 7 (D164): recommend 0–10 and one open
-- question. Written by the server (secret key) for the signed-in account;
-- read on the admin pages. Deleted with the account.
create table public.week_surveys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (char_length(video_id) between 1 and 80),
  week integer not null check (week >= 1),
  score integer not null check (score between 0 and 10),
  comment text check (char_length(comment) <= 1000),
  unique (user_id, video_id, week)
);

create index week_surveys_created_at on public.week_surveys (created_at desc);

alter table public.week_surveys enable row level security;
-- No policies: only the secret key (service_role) reads or writes.

-- Rollback:
--   drop table public.week_surveys;
