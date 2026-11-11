-- Practices from the learner's own recording (D130). Additive only.
--
-- The browser turns an MP3 or MP4 into one small MP3 (16 kHz mono) and
-- uploads it straight to this private bucket with a signed upload URL
-- the server makes; nobody can read it without a signed URL, which the
-- server makes only for those who may practice the practice. Files are
-- named <user id>/<random uuid>.mp3.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 52428800, array['audio/mpeg']);

alter table public.practices
add column source_audio_path text check (
  source_audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.mp3$'
),
add column source_audio_seconds numeric(8, 2) check (source_audio_seconds > 0),
-- When the author confirmed they own the recording or may share it.
add column rights_confirmed_at timestamptz,
-- A practice may only point at its own author's files.
add constraint practices_source_audio_owner check (
  source_audio_path is null
  or starts_with(source_audio_path, user_id::text || '/')
),
add constraint practices_source_audio_complete check (
  (source_audio_path is null) = (source_audio_seconds is null)
),
-- Private until the author confirms the rights.
add constraint practices_source_audio_public check (
  source_audio_path is null
  or visibility = 'private'
  or rights_confirmed_at is not null
);

-- Seconds of audio sent to speech to text, per call: the free tier has
-- 5 hours a month, and plans count their minutes (D130).
alter table public.api_calls
add column audio_ms integer not null default 0 check (audio_ms >= 0);

-- Milliseconds transcribed since `month_start`: the whole site's, and
-- one user's.
create function public.month_audio_ms(month_start timestamptz, target_user uuid)
returns table (site bigint, mine bigint)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(audio_ms), 0)::bigint,
    coalesce(sum(audio_ms) filter (where user_id = target_user), 0)::bigint
  from public.api_calls
  where created_at >= month_start and audio_ms > 0;
$$;

revoke execute on function public.month_audio_ms from public, anon, authenticated;
grant execute on function public.month_audio_ms to service_role;

-- Readable like the other columns (see 20261111000100): the practice
-- pages read them; the file itself stays behind signed URLs.
grant select (source_audio_path, source_audio_seconds, rights_confirmed_at) on public.practices to authenticated;
grant select (source_audio_path, source_audio_seconds, rights_confirmed_at) on public.practices to anon;
