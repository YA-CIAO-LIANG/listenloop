-- Reports and takedowns (roadmap e2, docs/decisions.md D31). Signed-in
-- users report someone else's public practice with a reason; admins
-- review the reports on the server (secret key) and take the practice
-- down or dismiss them. A taken-down practice is no longer public, and its
-- author sees why in My materials.

alter table public.practices
  add column removed_at timestamptz,
  add column removed_reason text
    check (removed_reason in ('copyright', 'inappropriate', 'personal', 'spam', 'other')),
  add constraint practices_removed_with_reason
    check ((removed_at is null) = (removed_reason is null));

-- Only moderators (the server's secret key, or the dashboard) take a
-- practice down or restore it; authors can't clear it themselves.
create function public.protect_practice_removal() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    (tg_op = 'INSERT' and (new.removed_at is not null or new.removed_reason is not null))
    or (tg_op = 'UPDATE' and (
      new.removed_at is distinct from old.removed_at
      or new.removed_reason is distinct from old.removed_reason
    ))
  ) then
    raise exception 'Only moderators can take a practice down or restore it'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger practices_protect_removal
before insert or update on public.practices
for each row execute function public.protect_practice_removal();

-- Public means public and not taken down.
drop policy "Read public practices" on public.practices;
create policy "Read public practices" on public.practices
for select to anon, authenticated
using (visibility = 'public' and removed_at is null);

drop policy "Sentences of public practices" on public.practice_sentences;
create policy "Sentences of public practices" on public.practice_sentences
for select to anon, authenticated
using (
  exists (
    select 1 from public.practices p
    where p.id = practice_id and p.visibility = 'public' and p.removed_at is null
  )
);

grant select (removed_at) on public.practices to anon;

create table public.practice_reports (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  reporter_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  reason text not null
    check (reason in ('copyright', 'inappropriate', 'personal', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  -- open until an admin removes the practice or dismisses the report.
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'removed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- One open report per person and practice.
create unique index practice_reports_one_open
on public.practice_reports (practice_id, reporter_id) where status = 'open';
create index practice_reports_open_created_at
on public.practice_reports (created_at) where status = 'open';
create index practice_reports_reporter_created_at
on public.practice_reports (reporter_id, created_at);

alter table public.practice_reports enable row level security;

-- Only a practice others can see, and not one's own.
create policy "Report public practices" on public.practice_reports
for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'open'
  and resolved_at is null
  and exists (
    select 1 from public.practices p
    where p.id = practice_id
      and p.visibility = 'public'
      and p.removed_at is null
      and p.user_id <> (select auth.uid())
  )
);

create policy "Read own reports" on public.practice_reports
for select to authenticated
using (reporter_id = (select auth.uid()));

revoke all on public.practice_reports from anon, authenticated;
grant select, insert on public.practice_reports to authenticated;
