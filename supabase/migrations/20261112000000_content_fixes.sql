-- Suggested fixes to published official materials, waiting for an admin
-- (D117): a sentence's Chinese (full-width digits, names, wording) or its
-- notes (shortened). Nothing changes until an admin accepts one; the
-- server then writes it and records it in the admin audit. Additive only.
create table public.content_fixes (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices (id) on delete cascade,
  sentence_index integer not null check (sentence_index >= 0),
  field text not null check (field in ('zh', 'notes')),
  kind text not null check (kind in ('full-width', 'name', 'translation', 'long-notes')),
  -- The value when the fix was suggested: accepting checks it's unchanged.
  current jsonb not null,
  suggested jsonb not null,
  -- Why, in the admin's language (hand-written fixes), or null.
  reason text check (reason is null or char_length(reason) <= 1000),
  -- Machine details, such as the steps that shortened notes.
  detail jsonb not null default '{}'::jsonb,
  source text not null check (char_length(source) between 1 and 100),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'stale')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
-- One pending fix per sentence and field.
create unique index content_fixes_pending
  on public.content_fixes (practice_id, sentence_index, field)
  where status = 'pending';
create index content_fixes_status on public.content_fixes (status, created_at);

-- Only the server (secret key) reads and writes them.
alter table public.content_fixes enable row level security;
revoke all on public.content_fixes from anon, authenticated;
grant all on public.content_fixes to service_role;
