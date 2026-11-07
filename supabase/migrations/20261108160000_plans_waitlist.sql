-- Plans (D72): each account is on the free or the paid plan, set by an
-- admin until payments exist. Free accounts may try one practice of
-- their own; `practices_created` counts every practice an account has
-- created, kept when a practice is deleted, so deleting one doesn't give
-- the trial back. Only the server writes profiles, as before (D50).

alter table public.profiles
add column plan text not null default 'free' check (plan in ('free', 'paid')),
add column practices_created integer not null default 0
  check (practices_created >= 0);

-- Counted as practices are created; existing ones counted once now.
create function public.count_practice_created() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set practices_created = practices_created + 1
  where user_id = new.user_id;
  return new;
end;
$$;

create trigger on_practice_created
after insert on public.practices
for each row execute function public.count_practice_created();

update public.profiles p
set practices_created = (
  select count(*) from public.practices x where x.user_id = p.user_id
);

-- The paid plan's waiting list (D72): one row per account that asked to
-- hear when it launches. People add and read only their own row; admins
-- read the list with the secret key.
create table public.waitlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "Join the waitlist" on public.waitlist
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Read own waitlist entry" on public.waitlist
for select to authenticated
using (user_id = (select auth.uid()));

grant select, insert on public.waitlist to authenticated;
grant all on public.waitlist to service_role;
