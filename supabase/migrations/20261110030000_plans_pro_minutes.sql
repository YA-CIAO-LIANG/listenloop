-- Plans and pricing (D102). Additive only:
-- - a "pro" plan next to "free" and "paid" (Plus); the check is widened,
--   no row changes;
-- - each practice's estimated length, for the monthly minutes a plan
--   allows (null on older practices: counted as a minute);
-- - the waiting list remembers the plan, billing period, and the page
--   people came from.
alter table public.profiles
drop constraint profiles_plan_check,
add constraint profiles_plan_check check (plan in ('free', 'paid', 'pro'));

alter table public.practices
add column estimated_seconds integer check (
  estimated_seconds between 0 and 7200
);

alter table public.waitlist
add column plan text check (plan in ('plus', 'pro')),
add column billing_period text check (
  billing_period in ('month', 'year', 'twoYear')
),
add column source text check (char_length(source) <= 32);
