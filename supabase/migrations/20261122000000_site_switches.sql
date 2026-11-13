-- Emergency switches and site announcements (D155). Additive only.
--
-- One row of switches (maintenance, read-only, each risky feature) and
-- the announcements shown on every page and on /status. Anyone may read
-- both (the status page and the proxy use the public key); only the
-- server (service_role) writes them, from /admin/ops, with every change
-- in admin_audit.

create table public.site_settings (
  id boolean primary key default true check (id),
  maintenance boolean not null default false,
  read_only boolean not null default false,
  -- { "aiGenerate": false, ... }: a feature set to false is paused.
  features jsonb not null default '{}'::jsonb
    check (jsonb_typeof(features) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.site_settings (id) values (true);

alter table public.site_settings enable row level security;
create policy "Anyone reads the switches" on public.site_settings
for select to anon, authenticated
using (true);
revoke all on public.site_settings from anon, authenticated;
grant select (id, maintenance, read_only, features, updated_at)
  on public.site_settings to anon, authenticated;
grant all on public.site_settings to service_role;

create table public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info'
    check (level in ('info', 'warning', 'critical')),
  body_zh text not null check (char_length(body_zh) between 1 and 500),
  body_en text not null check (char_length(body_en) between 1 and 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index site_announcements_starts_at
  on public.site_announcements (starts_at desc);

alter table public.site_announcements enable row level security;
create policy "Anyone reads the announcements" on public.site_announcements
for select to anon, authenticated
using (true);
revoke all on public.site_announcements from anon, authenticated;
grant select (id, level, body_zh, body_en, starts_at, ends_at)
  on public.site_announcements to anon, authenticated;
grant all on public.site_announcements to service_role;

-- Public sharing paused (D155): practices and collections can't become
-- public while the switch is off (or in maintenance or read-only),
-- however they're written. The server's secret key and admins may.
create function public.enforce_public_share_switch() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.site_settings;
begin
  if new.visibility = 'public'
    and (tg_op = 'INSERT' or old.visibility is distinct from 'public')
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin()
  then
    select * into settings from public.site_settings where id;
    if found and (
      settings.maintenance
      or settings.read_only
      or settings.features ->> 'publicShare' = 'false'
    ) then
      raise exception 'public sharing is paused' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_public_share_switch()
  from public, anon, authenticated;

create trigger practices_public_share_switch
before insert or update of visibility on public.practices
for each row execute function public.enforce_public_share_switch();
create trigger collections_public_share_switch
before insert or update of visibility on public.collections
for each row execute function public.enforce_public_share_switch();

-- Rollback:
--   drop trigger collections_public_share_switch on public.collections;
--   drop trigger practices_public_share_switch on public.practices;
--   drop function public.enforce_public_share_switch();
--   drop table public.site_announcements;
--   drop table public.site_settings;
-- The app treats a missing table as "everything on, no announcements".
