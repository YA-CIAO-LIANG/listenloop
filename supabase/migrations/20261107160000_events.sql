-- The activity log (P0-3, D55): sign-ins, practice started, each day
-- completed (with its score), retries, practices created / edited /
-- deleted / made public, reports, skipped sentences, speech recognition
-- failures, and deleted accounts. A user id and the fields needed, never
-- practice text, recognized speech, or recordings. Written by the server
-- (service_role) only; admins read. Kept 180 days (prune_logs).

create table public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  type text not null check (type in (
    'sign_in', 'practice_start', 'day_complete', 'retry',
    'practice_create', 'practice_edit', 'practice_delete', 'practice_public',
    'report', 'sentence_skip', 'recognition_fail', 'account_delete'
  )),
  video_id text check (char_length(video_id) <= 80),
  day smallint check (day between 1 and 7),
  score real check (score between 0 and 1),
  code text check (char_length(code) <= 40)
);

create index events_created_at on public.events (created_at desc);
create index events_user on public.events (user_id, created_at desc);
create index events_type on public.events (type, created_at desc);

alter table public.events enable row level security;

create policy "Admins read events" on public.events
for select to authenticated
using ((select public.is_admin()));

grant select on public.events to authenticated;
grant all on public.events to service_role;

-- Retention (D55): activity 180 days; hard-sentence reports and the API
-- call log a year. Run by the server when admins open the dashboard.
create function public.prune_logs() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.events where created_at < now() - interval '180 days';
  delete from public.shadowing_issues where created_at < now() - interval '365 days';
  delete from public.api_calls where created_at < now() - interval '365 days';
$$;

revoke all on function public.prune_logs() from public, anon, authenticated;
grant execute on function public.prune_logs() to service_role;
