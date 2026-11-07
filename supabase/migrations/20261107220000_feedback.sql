-- Feedback (P1, D60): what learners tell us from the footer's "Feedback"
-- form, with a category, and their account if they're signed in. Server
-- writes (service_role); admins read and mark it done. Deleted with the
-- account.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  category text not null check (category in ('bug', 'suggestion', 'content', 'account', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  page text check (char_length(page) <= 200),
  status text not null default 'open' check (status in ('open', 'done'))
);

create index feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "Admins read feedback" on public.feedback
for select to authenticated
using ((select public.is_admin()));

grant select on public.feedback to authenticated;
grant all on public.feedback to service_role;
