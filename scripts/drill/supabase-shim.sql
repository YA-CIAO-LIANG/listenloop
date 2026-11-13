-- The parts of Supabase the migrations rely on (D157), for the local
-- restore drill on a plain PostgreSQL: the API roles, auth.users and
-- auth.uid()/auth.role() (read from request.jwt.claims, as on
-- Supabase), and the storage tables. Not used in production.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now(),
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'sub',
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role'
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

grant usage on schema auth, storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
