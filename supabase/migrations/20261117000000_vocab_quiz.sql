-- The vocabulary quiz after dictation (D136). Additive only.
--
-- Each finished quiz, one row: its counts and each word's result. Kept
-- apart from progress: it never changes a dictation score, the pass
-- rules, or the week's result. Learners add, read, and delete their own
-- rows only; nobody updates them.
create table public.vocab_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  video_id text not null check (char_length(video_id) between 1 and 100),
  day smallint not null check (day in (1, 7)),
  taken_at timestamptz not null default now(),
  total smallint not null check (total between 1 and 20),
  spelling_correct smallint not null check (spelling_correct between 0 and total),
  translation_correct smallint not null
    check (translation_correct between 0 and total),
  hints_used smallint not null check (hints_used between 0 and 2 * total),
  -- [{ word, spelled, hints, translated }], one per word.
  words jsonb not null check (
    jsonb_typeof(words) = 'array'
    and jsonb_array_length(words) = total
    and octet_length(words::text) <= 4000
  )
);

create index vocab_quiz_attempts_user_taken
  on public.vocab_quiz_attempts (user_id, taken_at);

alter table public.vocab_quiz_attempts enable row level security;

create policy "Own quiz attempts: read" on public.vocab_quiz_attempts
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Own quiz attempts: add" on public.vocab_quiz_attempts
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Own quiz attempts: delete" on public.vocab_quiz_attempts
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.vocab_quiz_attempts from anon, authenticated;
grant select, insert, delete on public.vocab_quiz_attempts to authenticated;
grant all on public.vocab_quiz_attempts to service_role;
