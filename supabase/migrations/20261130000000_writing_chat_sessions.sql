-- WritingLoop chat practice (D197). Additive: one new table.
--
-- One row per chat, for the weekly chat minutes (lib/plans.ts): the
-- chosen length is counted when the chat starts, and what wasn't used is
-- given back when it ends early. No messages here: the conversation stays
-- with the learner (their browser and their own user_documents).
create table public.writing_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  minutes smallint not null check (minutes between 1 and 60),
  -- Set when the chat ends: the minutes counted (at most `minutes`).
  used_minutes smallint check (used_minutes between 0 and 60),
  messages smallint not null default 0 check (messages >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index writing_chat_sessions_user
  on public.writing_chat_sessions (user_id, started_at desc);
alter table public.writing_chat_sessions enable row level security;
-- Each learner reads their own; only the server writes.
create policy "Read own chat sessions" on public.writing_chat_sessions
for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.writing_chat_sessions from anon, authenticated;
grant select on public.writing_chat_sessions to authenticated;
grant all on public.writing_chat_sessions to service_role;

-- Rollback:
--   drop table public.writing_chat_sessions;
