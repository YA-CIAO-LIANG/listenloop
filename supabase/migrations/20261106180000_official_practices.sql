-- Official practices (D46): ones an admin made for everyone, listed in
-- the home page's library. An official practice is always public. Only
-- the server's secret key (an admin action) may mark or unmark one: the
-- trigger refuses it from users' own sessions, whose policies otherwise
-- let them update their practices.
alter table public.practices
add column official boolean not null default false;

alter table public.practices
add constraint practices_official_is_public
check (not official or visibility = 'public');

create function public.guard_official()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.official)
    or (tg_op = 'UPDATE' and new.official is distinct from old.official) then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'only admins mark official practices';
    end if;
  end if;
  return new;
end;
$$;

create trigger practices_official before insert or update on public.practices
for each row execute function public.guard_official();

create index practices_official_created_at on public.practices (created_at)
where official;

-- Everyone may see which public practices are official (column grants, D30).
grant select (official) on public.practices to anon;
