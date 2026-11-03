-- Signed-in users' practice data (docs/decisions.md D4). Each row is one
-- user's copy of a localStorage document: `data` holds the same JSON the
-- app stores locally (lib/progress.ts validates it on read).

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per user and video: ll-progress:v1:<videoId>.
create table public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (char_length(video_id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

-- Other per-user documents, e.g. key 'activity' (ll-activity:v1).
create table public.user_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9-]{0,49}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create trigger progress_updated_at before update on public.progress
for each row execute function public.set_updated_at();
create trigger user_documents_updated_at before update on public.user_documents
for each row execute function public.set_updated_at();

-- Row level security: a signed-in user reads and writes only their own
-- rows; signed-out visitors (anon) get nothing.
alter table public.progress enable row level security;
alter table public.user_documents enable row level security;

create policy "Own progress" on public.progress
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Own documents" on public.user_documents
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.progress, public.user_documents from anon;
grant select, insert, update, delete
on public.progress, public.user_documents to authenticated;
