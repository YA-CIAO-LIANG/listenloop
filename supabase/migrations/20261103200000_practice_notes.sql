-- Vocabulary and grammar notes for created practices (d6c, docs/decisions.md
-- D27), in the same shape as a built-in video's `vocab` and `grammar`
-- (lib/videos.ts). notes_generated_at stays null until they're made, so
-- "not generated yet" and "generated, nothing to note" differ.
alter table public.practices
add column vocab jsonb not null default '[]'::jsonb
  check (jsonb_typeof(vocab) = 'array'),
add column grammar jsonb not null default '[]'::jsonb
  check (jsonb_typeof(grammar) = 'array'),
add column notes_generated_at timestamptz;

-- Language-model results by content hash (translations, notes): the same
-- input is sent to the provider once. Server only, like speech_audio.
create table public.ai_cache (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('translation', 'notes')),
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_cache enable row level security;
revoke all on public.ai_cache from anon, authenticated;
