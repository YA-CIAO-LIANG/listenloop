-- Each sentence keeps its own vocabulary and grammar notes (D43), so an
-- edited practice regenerates notes only for sentences whose text
-- changed, and a sentence's notes are cached by its text across
-- practices. Shape: {"vocab": [{word, pos, zh, example}], "grammar":
-- [{point, explanation, example}]}; null until made. practices.vocab and
-- grammar stay as the whole practice's notes, joined from these.
alter table public.practice_sentences
add column notes jsonb check (
  notes is null
  or (
    jsonb_typeof(notes) = 'object'
    and jsonb_typeof(notes -> 'vocab') = 'array'
    and jsonb_typeof(notes -> 'grammar') = 'array'
  )
);

-- Practices made before: split their notes onto their sentences. Only
-- fills the new column; nothing existing changes.
update public.practice_sentences s
set notes = jsonb_build_object(
  'vocab', coalesce((
    select jsonb_agg(item - 'sentence')
    from jsonb_array_elements(p.vocab) item
    where (item ->> 'sentence')::int = s.i
  ), '[]'::jsonb),
  'grammar', coalesce((
    select jsonb_agg(point - 'sentence')
    from jsonb_array_elements(p.grammar) point
    where (point ->> 'sentence')::int = s.i
  ), '[]'::jsonb)
)
from public.practices p
where p.id = s.practice_id and p.notes_generated_at is not null;
