-- A practice from an uploaded recording (D130) keeps the length it was
-- made with, like a YouTube practice: it has no generated audio files to
-- add up, so the duration trigger leaves it alone.
create or replace function public.sync_practice_duration() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.practices p
  set duration_sec = public.practice_audio_seconds(p.id)
  where p.id = coalesce(new.practice_id, old.practice_id)
    and p.youtube_id is null
    and p.source_audio_path is null;
  return null;
end;
$$;
