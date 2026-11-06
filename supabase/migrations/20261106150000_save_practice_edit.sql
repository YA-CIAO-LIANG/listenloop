-- Saving an edited practice (D45) in one transaction: keep the version
-- being replaced as a snapshot (if it could be practiced, D44), replace
-- the sentences, and move the practice to the next version. Runs with
-- the caller's rights, so row level security applies, and only the
-- author may save. `expected_version` is the version the editor opened:
-- if someone saved in between, nothing changes ('version conflict').
-- new_sentences: [{ "en", "zh", "audio_path", "notes" }], in order.
create function public.save_practice_edit(
  target uuid,
  expected_version integer,
  new_title text,
  new_voice text,
  new_sentences jsonb,
  new_vocab jsonb,
  new_grammar jsonb,
  notes_ready boolean
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current public.practices%rowtype;
  practicable boolean;
begin
  select * into current from public.practices where id = target for update;
  if not found or current.user_id is distinct from (select auth.uid()) then
    raise exception 'not found';
  end if;
  if current.version <> expected_version then
    raise exception 'version conflict';
  end if;
  if jsonb_typeof(new_sentences) <> 'array'
    or jsonb_array_length(new_sentences) not between 1 and 300 then
    raise exception 'bad sentences';
  end if;

  practicable := current.notes_generated_at is not null
    and exists (
      select 1 from public.practice_sentences where practice_id = target
    )
    and not exists (
      select 1 from public.practice_sentences
      where practice_id = target and audio_path is null
    );
  if practicable then
    insert into public.practice_versions
      (practice_id, version, title, sentences, vocab, grammar)
    select target, current.version, current.title,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'en', s.en, 'zh', s.zh, 'audio_path', s.audio_path, 'notes', s.notes
          ) order by s.i
        )
        from public.practice_sentences s where s.practice_id = target
      ), '[]'::jsonb),
      current.vocab, current.grammar
    on conflict (practice_id, version) do nothing;
  end if;

  delete from public.practice_sentences where practice_id = target;
  insert into public.practice_sentences (practice_id, i, en, zh, audio_path, notes)
  select target, (t.ord - 1)::integer, t.s ->> 'en', coalesce(t.s ->> 'zh', ''),
    t.s ->> 'audio_path',
    case when jsonb_typeof(t.s -> 'notes') = 'object' then t.s -> 'notes' end
  from jsonb_array_elements(new_sentences) with ordinality as t(s, ord);

  update public.practices
  set title = new_title,
    voice = new_voice,
    version = current.version + 1,
    vocab = new_vocab,
    grammar = new_grammar,
    notes_generated_at = case when notes_ready then now() end
  where id = target;
  return current.version + 1;
end;
$$;

revoke execute on function public.save_practice_edit from public, anon;
grant execute on function public.save_practice_edit to authenticated;
