-- Public sharing (roadmap e1, docs/decisions.md D30): anyone, signed in
-- or not, can read the practices their authors made public, with their
-- sentences, so others can browse and practice them. Writing stays
-- owner-only (the "Own practices" policies are unchanged).

create policy "Read public practices" on public.practices
for select to anon, authenticated
using (visibility = 'public');

create policy "Sentences of public practices" on public.practice_sentences
for select to anon, authenticated
using (
  exists (
    select 1 from public.practices p
    where p.id = practice_id and p.visibility = 'public'
  )
);

-- Signed-out visitors read only what a practice page needs: no author id,
-- collection, or timestamps besides creation.
grant select (
  id, title, source_language, voice, visibility, vocab, grammar,
  notes_generated_at, created_at
) on public.practices to anon;
grant select on public.practice_sentences to anon;

-- The newest public practices first, for /explore.
create index practices_public_created_at on public.practices (created_at desc)
where visibility = 'public';
