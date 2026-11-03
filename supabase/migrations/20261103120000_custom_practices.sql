-- Practices users build from their own text (roadmap d, docs/decisions.md
-- D19, D20). Every table has row level security: a user reads and writes
-- only their own rows. Public sharing (roadmap e) adds its read policies
-- later; `visibility` is stored now so d5 can set it.

-- A user's group of practices, like the built-in library's collections.
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default ''
    check (char_length(description) <= 1000),
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One practice made from an uploaded text file.
create table public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  -- The language of the uploaded text; Chinese is translated to English.
  source_language text not null check (source_language in ('en', 'zh')),
  -- The voice id the audio was made with (d3); null until then.
  voice text check (char_length(voice) between 1 and 100),
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The sentences of a practice, in order: `en` is what the learner hears
-- and types; `zh` is the Chinese line for the handout.
create table public.practice_sentences (
  practice_id uuid not null references public.practices (id) on delete cascade,
  i integer not null check (i between 0 and 999),
  en text not null check (char_length(en) between 1 and 1000),
  zh text not null default '' check (char_length(zh) <= 1000),
  primary key (practice_id, i)
);

-- A private notebook of words and sentences the learner saves.
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notebook_entries (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  note text not null default '' check (char_length(note) <= 2000),
  -- Where it came from, e.g. 'video:sintel' or 'practice:<uuid>'.
  source text check (char_length(source) between 1 and 200),
  sentence integer check (sentence between 0 and 999),
  created_at timestamptz not null default now()
);

-- Characters sent to the paid APIs per user and day (Taiwan time, D7).
-- Written only by the server through reserve_api_usage.
create table public.api_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('speech', 'translation')),
  chars integer not null default 0 check (chars >= 0),
  primary key (user_id, day, kind)
);

create index practices_user_id on public.practices (user_id);
create index practices_collection_id on public.practices (collection_id);
create index collections_user_id on public.collections (user_id);
create index notebooks_user_id on public.notebooks (user_id);
create index notebook_entries_notebook_id on public.notebook_entries (notebook_id);
create index notebook_entries_user_id on public.notebook_entries (user_id);

create trigger collections_updated_at before update on public.collections
for each row execute function public.set_updated_at();
create trigger practices_updated_at before update on public.practices
for each row execute function public.set_updated_at();
create trigger notebooks_updated_at before update on public.notebooks
for each row execute function public.set_updated_at();

alter table public.collections enable row level security;
alter table public.practices enable row level security;
alter table public.practice_sentences enable row level security;
alter table public.notebooks enable row level security;
alter table public.notebook_entries enable row level security;
alter table public.api_usage enable row level security;

create policy "Own collections" on public.collections
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- A practice can only be put in one of the owner's own collections.
create policy "Own practices" on public.practices
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    collection_id is null
    or exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
  )
);

create policy "Sentences of own practices" on public.practice_sentences
for all to authenticated
using (
  exists (
    select 1 from public.practices p
    where p.id = practice_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.practices p
    where p.id = practice_id and p.user_id = (select auth.uid())
  )
);

create policy "Own notebooks" on public.notebooks
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Entries of own notebooks" on public.notebook_entries
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.notebooks n
    where n.id = notebook_id and n.user_id = (select auth.uid())
  )
);

-- Users may see their own usage but never change it.
create policy "Read own usage" on public.api_usage
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.collections, public.practices, public.practice_sentences,
  public.notebooks, public.notebook_entries, public.api_usage from anon;
grant select, insert, update, delete
on public.collections, public.practices, public.practice_sentences,
  public.notebooks, public.notebook_entries to authenticated;
revoke all on public.api_usage from authenticated;
grant select on public.api_usage to authenticated;

-- Adds `amount` characters to today's usage only if the total stays within `max_chars`,
-- in one statement, so two requests at once can't both slip past the limit.
-- True when reserved. Called by the server with the secret key only.
create function public.reserve_api_usage(
  target_user uuid,
  usage_kind text,
  usage_day date,
  amount integer,
  max_chars integer
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  reserved boolean;
begin
  if amount < 0 then
    raise exception 'amount must not be negative';
  end if;
  insert into public.api_usage as u (user_id, day, kind, chars)
  select target_user, usage_day, usage_kind, amount
  where amount <= max_chars
  on conflict (user_id, day, kind) do update
    set chars = u.chars + excluded.chars
    where u.chars + excluded.chars <= max_chars
  returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

revoke execute on function public.reserve_api_usage from public, anon, authenticated;
grant execute on function public.reserve_api_usage to service_role;
