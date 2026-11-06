-- Versions of a created practice (D44). Editing a practice makes a new
-- version; a 7-day cycle keeps using the version it started with, so its
-- Day 1 and Day 7 compare the same sentences. The practice's own rows
-- are always the latest version; each earlier, practicable version is
-- kept whole here as a snapshot when it's replaced. Audio files are named
-- by their content, never deleted, so a snapshot's paths keep working.
alter table public.practices
add column version integer not null default 1 check (version >= 1);

create table public.practice_versions (
  practice_id uuid not null references public.practices (id) on delete cascade,
  version integer not null check (version >= 1),
  title text not null check (char_length(title) between 1 and 200),
  -- [{ "en", "zh", "audio_path", "notes" }], in order.
  sentences jsonb not null check (jsonb_typeof(sentences) = 'array'),
  vocab jsonb not null check (jsonb_typeof(vocab) = 'array'),
  grammar jsonb not null check (jsonb_typeof(grammar) = 'array'),
  created_at timestamptz not null default now(),
  primary key (practice_id, version)
);

alter table public.practice_versions enable row level security;

-- Read like the practice itself: the author's own, or a public one.
create policy "Versions of readable practices" on public.practice_versions
for select to anon, authenticated
using (
  exists (
    select 1 from public.practices p
    where p.id = practice_id
      and (p.visibility = 'public' or p.user_id = (select auth.uid()))
  )
);

-- Only the author adds a snapshot; snapshots never change.
create policy "Snapshot own practices" on public.practice_versions
for insert to authenticated
with check (
  exists (
    select 1 from public.practices p
    where p.id = practice_id and p.user_id = (select auth.uid())
  )
);

revoke all on public.practice_versions from anon, authenticated;
grant select on public.practice_versions to anon, authenticated;
grant insert on public.practice_versions to authenticated;

-- Public practices show their version to everyone (column grants, D30).
grant select (version) on public.practices to anon;
