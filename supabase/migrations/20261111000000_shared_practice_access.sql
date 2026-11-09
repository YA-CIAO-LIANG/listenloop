-- Shared materials are for paying plans (D106), part 1 of 2: the access
-- check and the functions the app uses, added before the app needs them.
-- Part 2 (20261111000100_shared_practice_lock.sql) applies them, after
-- the app that uses these functions is deployed.
--
-- Shared materials are for paying plans. Anyone can still find and
-- preview a public practice someone shared, but only these may practice
-- it (read its sentences, notes, and earlier versions):
--   - its author;
--   - Plus, Pro, and class plan accounts, and admins;
--   - students of a class it's assigned to;
--   - a learner already in a week of it when this rule began, until that
--     week ends (shared_practice_grants below).
-- Official materials stay open to everyone. Free accounts and signed-out
-- visitors see a preview: titles, details, the first three sentences in
-- English and Chinese, and the first sentence's audio (practice_preview).

-- Weeks already under way when the rule began, so they can be finished.
-- Only the server reads it (inside can_practice).
create table public.shared_practice_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  practice_id uuid not null references public.practices (id) on delete cascade,
  -- The week and its start date (progress.data.week / startedAt) it covers.
  week integer not null,
  started_at text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, practice_id)
);
alter table public.shared_practice_grants enable row level security;
revoke all on public.shared_practice_grants from anon, authenticated;
grant all on public.shared_practice_grants to service_role;


-- Whether the signed-in user (or a signed-out visitor) may practice it.
create function public.can_practice(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.practices p
    where p.id = target
      and (
        p.user_id = (select auth.uid())
        or (
          p.visibility = 'public'
          and p.removed_at is null
          and (
            p.official
            or exists (
              select 1 from public.profiles f
              where f.user_id = (select auth.uid())
                and f.status = 'active'
                and (
                  f.role = 'admin'
                  or f.plan in ('paid', 'pro')
                  or f.classroom_seats is not null
                )
            )
            or exists (
              select 1 from public.assignments a
              join public.class_members m on m.class_id = a.class_id
              where m.user_id = (select auth.uid())
                and a.video_id = 'p-' || p.id::text
            )
            or exists (
              select 1 from public.shared_practice_grants g
              join public.progress pr
                on pr.user_id = g.user_id
                and pr.video_id = 'p-' || g.practice_id::text
              where g.user_id = (select auth.uid())
                and g.practice_id = p.id
                and g.created_at > now() - interval '60 days'
                and pr.data ->> 'week' = g.week::text
                and pr.data ->> 'startedAt' = g.started_at
                and coalesce(pr.data ->> 'status', 'in-progress') = 'in-progress'
            )
          )
        )
      )
  );
$$;
revoke all on function public.can_practice(uuid) from public;
grant execute on function public.can_practice(uuid) to anon, authenticated, service_role;

-- Signed-out visitors may read the columns the library and the preview
-- list (missing since D97 and D104, so the signed-out library couldn't
-- list official materials).
grant select (
  categories, duration_sec, youtube_id, youtube_channel, youtube_license,
  source_name, source_title, source_url
) on public.practices to anon;

create function public.practice_notes(target uuid)
returns table (vocab jsonb, grammar jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.vocab, p.grammar from public.practices p
  where p.id = target and public.can_practice(target);
$$;
revoke all on function public.practice_notes(uuid) from public;
grant execute on function public.practice_notes(uuid) to anon, authenticated, service_role;

-- The preview of a shared practice: its first three sentences (English
-- and Chinese, no notes), the first one's audio, and how many there are.
-- Null for anything not shared, not ready, or official.
create function public.practice_preview(target uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'sentence_count', (
      select count(*) from public.practice_sentences s where s.practice_id = p.id
    ),
    'sentences', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('i', s.i, 'en', s.en, 'zh', s.zh)
          order by s.i
        ),
        '[]'::jsonb
      )
      from public.practice_sentences s
      where s.practice_id = p.id and s.i < 3
    ),
    'audio_path', (
      select s.audio_path from public.practice_sentences s
      where s.practice_id = p.id and s.i = 0
    )
  )
  from public.practices p
  where p.id = target
    and p.visibility = 'public'
    and p.removed_at is null
    and p.published
    and not p.official
    and p.notes_generated_at is not null;
$$;
revoke all on function public.practice_preview(uuid) from public;
grant execute on function public.practice_preview(uuid) to anon, authenticated, service_role;

-- How many sentences each public practice has and how many are voiced,
-- so lists can tell which are ready without reading the sentences
-- themselves (which free accounts no longer may).
create function public.public_practice_readiness(targets uuid[])
returns table (practice_id uuid, sentences integer, voiced integer)
language sql stable security definer set search_path = ''
as $$
  select s.practice_id, count(*)::integer, count(s.audio_path)::integer
  from public.practice_sentences s
  join public.practices p on p.id = s.practice_id
  where s.practice_id = any (targets)
    and p.visibility = 'public'
    and p.removed_at is null
  group by s.practice_id;
$$;
revoke all on function public.public_practice_readiness(uuid[]) from public;
grant execute on function public.public_practice_readiness(uuid[]) to anon, authenticated, service_role;
