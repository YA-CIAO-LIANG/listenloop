-- Opening sign-ups in stages (D132). Additive only.
--
-- A new account is admitted once, right after its first sign-in: with a
-- valid invite (no cap), or while public sign-ups are open and under the
-- cap. Otherwise the server deletes the just-made account and shows
-- "the Beta is full" with the waiting list. Every account that exists
-- today is admitted. Only the server (service_role) reads or writes
-- these tables.

-- One row: whether anyone may sign up, and how many accounts at most.
create table public.signup_settings (
  id boolean primary key default true check (id),
  open boolean not null default true,
  cap integer not null default 50 check (cap between 0 and 1000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.signup_settings (id) values (true);

alter table public.signup_settings enable row level security;
revoke all on public.signup_settings from anon, authenticated;
grant all on public.signup_settings to service_role;

-- Invites: a code (shared as a link) for one or more people, until a date.
create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  note text check (char_length(note) <= 200),
  max_uses integer not null default 1 check (max_uses between 1 and 10000),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.beta_invite_uses (
  invite_id uuid not null references public.beta_invites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

-- The Beta waiting list: people who couldn't sign up yet. No account.
create table public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    char_length(email) <= 254 and email = lower(email) and email like '%@%'
  ),
  purpose text not null default '' check (char_length(purpose) <= 500),
  created_at timestamptz not null default now(),
  invited_at timestamptz,
  invite_id uuid references public.beta_invites (id) on delete set null
);
create index beta_waitlist_created_at on public.beta_waitlist (created_at);

alter table public.beta_invites enable row level security;
alter table public.beta_invite_uses enable row level security;
alter table public.beta_waitlist enable row level security;
revoke all on public.beta_invites, public.beta_invite_uses,
  public.beta_waitlist from anon, authenticated;
grant all on public.beta_invites, public.beta_invite_uses,
  public.beta_waitlist to service_role;

-- When and how each account was let in ("existing", "open", "invite",
-- "admin"); null: not yet (signed in for the first time a moment ago).
alter table public.profiles
add column beta_admitted_at timestamptz,
add column beta_admitted_via text check (
  beta_admitted_via in ('existing', 'open', 'invite', 'admin')
);
update public.profiles
set beta_admitted_at = created_at, beta_admitted_via = 'existing';
create index profiles_beta_admitted on public.profiles (beta_admitted_at)
where beta_admitted_at is not null;

-- Admits `target` (D132), atomically: the settings row is locked so two
-- sign-ups can't both take the last place. Answers "admitted" (already
-- in), "invite", "open", "admin", or why not: "full", "closed".
create function public.admit_account(
  target uuid,
  invite_code text,
  as_admin boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.signup_settings;
  invite public.beta_invites;
  admitted integer;
begin
  select * into settings from public.signup_settings where id for update;
  if exists (
    select 1 from public.profiles
    where user_id = target and beta_admitted_at is not null
  ) then
    return 'admitted';
  end if;
  if as_admin then
    update public.profiles
    set beta_admitted_at = now(), beta_admitted_via = 'admin'
    where user_id = target;
    return 'admin';
  end if;
  if invite_code is not null then
    select * into invite from public.beta_invites
    where code = upper(invite_code)
      and revoked_at is null
      and (expires_at is null or expires_at > now())
      and uses < max_uses
    for update;
    if found then
      update public.beta_invites set uses = uses + 1 where id = invite.id;
      insert into public.beta_invite_uses (invite_id, user_id)
      values (invite.id, target) on conflict do nothing;
      update public.profiles
      set beta_admitted_at = now(), beta_admitted_via = 'invite'
      where user_id = target;
      return 'invite';
    end if;
  end if;
  if not settings.open then
    return 'closed';
  end if;
  select count(*) into admitted from public.profiles
  where beta_admitted_at is not null and role <> 'admin';
  if admitted >= settings.cap then
    return 'full';
  end if;
  update public.profiles
  set beta_admitted_at = now(), beta_admitted_via = 'open'
  where user_id = target;
  return 'open';
end;
$$;

-- Accounts let in so far (admins aren't counted), for the cap.
create function public.beta_admitted_count() returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.profiles
  where beta_admitted_at is not null and role <> 'admin';
$$;

revoke all on function public.admit_account, public.beta_admitted_count
  from public, anon, authenticated;
grant execute on function public.admit_account, public.beta_admitted_count
  to service_role;
