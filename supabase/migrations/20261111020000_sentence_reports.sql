-- Learners report a problem with one sentence of a material (D113): a
-- wrong translation, wrong notes, or bad audio. Admins fix it and mark it
-- fixed; the reporter is told on their next visit. Additive only.
create table public.sentence_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- A built-in video id or "p-<uuid>", and the version the learner saw.
  video_id text not null check (char_length(video_id) between 1 and 100),
  material_version integer,
  sentence_index integer not null check (sentence_index >= 0),
  kind text not null check (kind in ('translation', 'notes', 'audio')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'fixed', 'dismissed')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- When the reporter saw that it was fixed.
  notified_at timestamptz
);
create index sentence_reports_open on public.sentence_reports (status, created_at desc);
create index sentence_reports_user on public.sentence_reports (user_id);

alter table public.sentence_reports enable row level security;
revoke all on public.sentence_reports from anon, authenticated;
grant select, insert on public.sentence_reports to authenticated;
grant all on public.sentence_reports to service_role;

-- Learners send open reports as themselves and read their own; resolving
-- and noting the notice are done by the server.
create policy "Send sentence reports" on public.sentence_reports
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'open'
  and resolved_at is null
  and resolution_note is null
  and notified_at is null
);
create policy "Read own sentence reports" on public.sentence_reports
for select to authenticated
using (user_id = (select auth.uid()));
