-- Upgrading a practice's notes to a new format (D69) in one transaction,
-- like saving an edit (D45): the version being replaced is kept as a
-- snapshot (so a week in progress keeps its notes, D44), then every
-- sentence gets its new notes and the practice moves to the next
-- version. Sentences and audio don't change. Only the server (the secret
-- key) calls it: scripts/upgrade-notes.record.ts.
-- new_notes: one notes object per sentence, in sentence order.
create function public.upgrade_practice_notes(
  target uuid,
  new_notes jsonb,
  new_vocab jsonb,
  new_grammar jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current public.practices%rowtype;
  sentence_count integer;
begin
  select * into current from public.practices where id = target for update;
  if not found then
    raise exception 'not found';
  end if;
  select count(*) into sentence_count
    from public.practice_sentences where practice_id = target;
  if jsonb_typeof(new_notes) <> 'array'
    or jsonb_array_length(new_notes) <> sentence_count then
    raise exception 'one notes object per sentence';
  end if;

  if current.notes_generated_at is not null and not exists (
    select 1 from public.practice_sentences
    where practice_id = target and audio_path is null
  ) then
    insert into public.practice_versions
      (practice_id, version, title, sentences, vocab, grammar)
    select target, current.version, current.title,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'en', s.en, 'zh', s.zh, 'audio_path', s.audio_path,
            'notes', s.notes, 'speaker', s.speaker
          ) order by s.i
        )
        from public.practice_sentences s where s.practice_id = target
      ), '[]'::jsonb),
      current.vocab, current.grammar
    on conflict (practice_id, version) do nothing;
  end if;

  update public.practice_sentences s
  set notes = new_notes -> s.i
  where s.practice_id = target;

  update public.practices
  set version = current.version + 1,
    vocab = new_vocab,
    grammar = new_grammar,
    notes_generated_at = now()
  where id = target;
  return current.version + 1;
end;
$$;

revoke all on function public.upgrade_practice_notes(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.upgrade_practice_notes(uuid, jsonb, jsonb, jsonb) to service_role;
