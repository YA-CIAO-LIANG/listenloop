-- Making a practice official copies it (D80): the admin's own practice
-- stays as it is, and the copy becomes an official draft (private until
-- published from /admin/official), owned by the admin who copied it.
-- Its sentences keep their audio files and notes, so nothing is made
-- again. Only the server (secret key) may call it.

create function public.copy_practice_as_official(source uuid, actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  copy_id uuid;
begin
  insert into public.practices (
    user_id, title, subtitle, source_language, voice, voice_b,
    category, scenario, level, exam, exam_target,
    vocab, grammar, notes_generated_at,
    official, published, visibility
  )
  select
    actor, p.title, p.subtitle, p.source_language, p.voice, p.voice_b,
    p.category, p.scenario, p.level, p.exam, p.exam_target,
    p.vocab, p.grammar, p.notes_generated_at,
    true, false, 'private'
  from public.practices p
  where p.id = source and p.removed_at is null
  returning id into copy_id;

  if copy_id is null then
    return null;
  end if;

  insert into public.practice_sentences (
    practice_id, i, en, zh, audio_path, notes, speaker
  )
  select copy_id, s.i, s.en, s.zh, s.audio_path, s.notes, s.speaker
  from public.practice_sentences s
  where s.practice_id = source;

  return copy_id;
end;
$$;

revoke all on function public.copy_practice_as_official(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.copy_practice_as_official(uuid, uuid)
  to service_role;
