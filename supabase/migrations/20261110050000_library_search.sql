-- Library search on the server (D104): the home page filters official
-- materials by category (overlaps) and audio length (gte / lte) in the
-- database. Additive only.

-- Categories as an array, kept from `category` by Postgres itself, so a
-- search can ask for any of several categories with `overlaps`.
alter table public.practices
add column categories text[] generated always as (
  case when category is null then '{}'::text[] else array[category] end
) stored;
create index practices_categories on public.practices using gin (categories);

-- How long a practice's audio runs, in whole seconds: the sum of its
-- sentences' files, the same estimate as lib/library-config.ts
-- audioSeconds (MP3 at 48 kbit/s; WAV 24 kHz 16-bit after a 44-byte
-- header). YouTube practices keep the excerpt length set when made.
alter table public.practices
add column duration_sec integer check (duration_sec >= 0);
create index practices_duration on public.practices (duration_sec);

create function public.practice_audio_seconds(target uuid) returns integer
language sql stable security definer set search_path = ''
as $$
  select round(coalesce(sum(
    case when a.mime_type = 'audio/wav'
      then greatest(0, a.bytes - 44) / 48000.0
      else a.bytes * 8 / 48000.0
    end
  ), 0))::integer
  from public.practice_sentences s
  join public.speech_audio a on a.path = s.audio_path
  where s.practice_id = target;
$$;
revoke all on function public.practice_audio_seconds(uuid) from public;

-- Kept up to date as audio is made or changed (any writer: the app,
-- batch scripts, the admin's tools).
create function public.sync_practice_duration() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.practices p
  set duration_sec = public.practice_audio_seconds(p.id)
  where p.id = coalesce(new.practice_id, old.practice_id)
    and p.youtube_id is null;
  return null;
end;
$$;

create trigger practice_sentences_duration
after insert or update of audio_path or delete on public.practice_sentences
for each row execute function public.sync_practice_duration();

-- Existing practices: from their audio now; YouTube ones from the length
-- recorded when they were made.
update public.practices p
set duration_sec = case
  when p.youtube_id is null then public.practice_audio_seconds(p.id)
  else p.estimated_seconds
end;
