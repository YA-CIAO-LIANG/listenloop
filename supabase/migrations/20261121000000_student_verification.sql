-- The student plan (D144): when this account last signed in with a school
-- email (a .edu, .edu.tw … Google account). Good for a year; written by
-- the server on sign-in. Add-only.
alter table public.profiles
  add column if not exists student_verified_at timestamptz;

-- Interest in the student plan is recorded like Plus and Pro's.
alter table public.waitlist
  drop constraint if exists waitlist_plan_check;
alter table public.waitlist
  add constraint waitlist_plan_check check (plan in ('plus', 'pro', 'student'));
