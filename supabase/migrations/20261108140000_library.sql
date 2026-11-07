-- The library (D70, D71): each material's one-line subtitle, how many
-- people practice each one (for "most practiced"), and how long each
-- practice's audio runs (for the length filter and the time estimate).
-- Counts and lengths are totals only: nothing about who practiced.

alter table public.practices
add column subtitle text check (char_length(subtitle) between 1 and 60);

grant select (subtitle) on public.practices to anon;

-- People with progress on each material (built-in videos and practices).
create function public.material_learner_counts()
returns table (video_id text, learners integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.video_id, count(*)::integer
  from public.progress p
  group by p.video_id;
$$;

revoke all on function public.material_learner_counts() from public;
grant execute on function public.material_learner_counts()
  to anon, authenticated, service_role;

-- Bytes of voiced audio per public practice, with the files' type, so
-- the app can work out the length (lib/library-config.ts audioSeconds).
-- Only practices anyone may read: public and not taken down.
create function public.practice_audio_bytes(ids uuid[])
returns table (practice_id uuid, mime_type text, bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.practice_id, a.mime_type, sum(a.bytes)::bigint
  from public.practice_sentences s
  join public.practices p on p.id = s.practice_id
  join public.speech_audio a on a.path = s.audio_path
  where s.practice_id = any (ids)
    and p.visibility = 'public'
    and p.removed_at is null
  group by s.practice_id, a.mime_type;
$$;

revoke all on function public.practice_audio_bytes(uuid[]) from public;
grant execute on function public.practice_audio_bytes(uuid[])
  to anon, authenticated, service_role;
