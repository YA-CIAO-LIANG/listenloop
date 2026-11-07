-- Sentences shadowing keeps failing on (D52): when a learner gets five
-- attempts in a row under 50% on one sentence, what they chose (try again
-- or skip and report) is recorded with each attempt's coverage and the
-- recognized text: text only, never audio. Signed-out learners report
-- without a user id. Written by the server (service_role); admins read.

create table public.shadowing_issues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  video_id text not null check (char_length(video_id) between 1 and 80),
  material_version integer check (material_version > 0),
  sentence_index integer not null check (sentence_index >= 0),
  coverages real[] not null check (cardinality(coverages) between 1 and 20),
  heard text[] not null check (cardinality(heard) between 1 and 20),
  browser text not null check (char_length(browser) <= 60),
  skipped boolean not null
);

create index shadowing_issues_sentence
  on public.shadowing_issues (video_id, sentence_index);

alter table public.shadowing_issues enable row level security;

create policy "Admins read shadowing issues" on public.shadowing_issues
for select to authenticated
using ((select public.is_admin()));

grant select on public.shadowing_issues to authenticated;
grant all on public.shadowing_issues to service_role;
