-- What each account has made (D143): one row per practice created, with
-- its estimated length, kept when the practice is deleted. The free
-- plan's minutes a week and the paid plans' minutes a month count these,
-- so deleting a practice doesn't give its minutes back (each one cost a
-- voice and AI calls). Add-only.
create table if not exists public.practice_creations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  practice_id uuid,
  seconds integer not null check (seconds >= 0 and seconds <= 36000),
  created_at timestamptz not null default now()
);

create index if not exists practice_creations_user_created
  on public.practice_creations (user_id, created_at);

alter table public.practice_creations enable row level security;

-- Each account reads its own; only the trigger writes.
create policy "practice_creations: read own"
  on public.practice_creations for select to authenticated
  using (user_id = auth.uid());
grant select on public.practice_creations to authenticated;

create or replace function public.record_practice_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.practice_creations (user_id, practice_id, seconds, created_at)
  values (new.user_id, new.id, coalesce(new.estimated_seconds, 60), new.created_at);
  return new;
end;
$$;
revoke all on function public.record_practice_creation() from public, anon, authenticated;

drop trigger if exists practices_record_creation on public.practices;
create trigger practices_record_creation
  after insert on public.practices
  for each row execute function public.record_practice_creation();

-- The practices that exist today, so this month and week count as before.
insert into public.practice_creations (user_id, practice_id, seconds, created_at)
select p.user_id, p.id, coalesce(p.estimated_seconds, 60), p.created_at
from public.practices p
where p.user_id is not null
  and not exists (
    select 1 from public.practice_creations c where c.practice_id = p.id
  );
