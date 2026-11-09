-- Practice reminders (D111): each browser a learner turns reminders on
-- in gets a push subscription with the time of day to be reminded (in
-- their time zone). Additive only. The learner manages their own rows;
-- the reminder job (scripts/send-reminders.mts, with the secret key)
-- reads them all and notes the day it last sent one.
create table public.reminders (
  endpoint text primary key check (char_length(endpoint) between 1 and 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  -- "HH:MM", 24-hour, in time_zone.
  remind_at text not null check (remind_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  time_zone text not null check (char_length(time_zone) between 1 and 64),
  -- The interface language, for the notification's text.
  locale text not null default 'zh-Hant' check (locale in ('zh-Hant', 'en')),
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_user on public.reminders (user_id);

alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant all on public.reminders to service_role;

create policy "Own reminders" on public.reminders
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
