-- Per-account quota changes and pausing AI (D161). Additive only.
--
-- An admin can give one account more of a limit for a while, or less
-- (a negative amount), always with a reason; each change is in
-- admin_audit too. Pausing AI (by hand, or by abuse detection, D162)
-- stops every paid AI step for that account until lifted.

create table public.quota_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  limit_name text not null check (limit_name in (
    'minutesPerWeek', 'minutesPerMonth', 'storageMegabytes', 'revisesPerDay'
  )),
  extra integer not null check (extra between -100000 and 100000 and extra <> 0),
  expires_at timestamptz not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index quota_overrides_user on public.quota_overrides (user_id, expires_at);

alter table public.quota_overrides enable row level security;
-- People see their own (their quota page shows the extra); only the
-- server writes.
create policy "Read own quota overrides" on public.quota_overrides
for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.quota_overrides from anon, authenticated;
grant select on public.quota_overrides to authenticated;
grant all on public.quota_overrides to service_role;

alter table public.profiles
  add column ai_suspended_at timestamptz,
  add column ai_suspended_reason text
    check (char_length(ai_suspended_reason) <= 500);

-- Rollback:
--   alter table public.profiles drop column ai_suspended_reason,
--     drop column ai_suspended_at;
--   drop table public.quota_overrides;
