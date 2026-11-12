-- Capacity (D133). Additive only.

-- A queue for work a free-tier service can only do so fast (Azure
-- Speech F0: text to speech 20 requests a minute, speech to text one
-- request at a time). Each job (a practice's audio, a recording's
-- transcript) holds a ticket; the first `slots` tickets in line work,
-- the rest wait and are told their place. A ticket not seen for a while
-- (the page was closed) drops out. Server only.
create table public.work_queue (
  ticket text primary key check (char_length(ticket) between 1 and 200),
  resource text not null check (resource in ('speech', 'transcribe')),
  user_id uuid references auth.users (id) on delete cascade,
  priority integer not null default 0,
  enqueued_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index work_queue_line on public.work_queue
  (resource, priority desc, enqueued_at);

alter table public.work_queue enable row level security;
revoke all on public.work_queue from anon, authenticated;
grant all on public.work_queue to service_role;

-- Joins (or stays in) the line and answers how many are ahead: 0 up to
-- slots - 1 means it's this ticket's turn.
create function public.queue_position(
  target_resource text,
  target_ticket text,
  target_user uuid,
  target_priority integer,
  stale_seconds integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  mine public.work_queue;
  ahead integer;
begin
  delete from public.work_queue
  where resource = target_resource
    and seen_at < now() - make_interval(secs => stale_seconds);
  insert into public.work_queue (ticket, resource, user_id, priority)
  values (target_ticket, target_resource, target_user, target_priority)
  on conflict (ticket) do update set seen_at = now()
  returning * into mine;
  select count(*) into ahead from public.work_queue q
  where q.resource = target_resource
    and q.ticket <> mine.ticket
    and (q.priority > mine.priority
      or (q.priority = mine.priority and q.enqueued_at < mine.enqueued_at));
  return ahead;
end;
$$;

-- Leaves the line (the job is done or gave up).
create function public.queue_leave(target_ticket text) returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.work_queue where ticket = target_ticket;
$$;

revoke all on function public.queue_position, public.queue_leave
  from public, anon, authenticated;
grant execute on function public.queue_position, public.queue_leave
  to service_role;

-- Lookups that scanned whole tables: a file's cache row by its path
-- (deleting an account's audio, the library's audio lengths), and which
-- sentences use a file.
create index if not exists speech_audio_path on public.speech_audio (path);
create index if not exists practice_sentences_audio_path
  on public.practice_sentences (audio_path) where audio_path is not null;
