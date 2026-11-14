-- Class plans become three tiers by class size (D173): 15, 40, and 100
-- students. 15 is new; earlier grants (10, 20, 80, D103) keep working.
alter table public.profiles
  drop constraint if exists profiles_classroom_seats_check;
alter table public.profiles
  add constraint profiles_classroom_seats_check
  check (classroom_seats in (10, 15, 20, 40, 80, 100));

-- Rollback: (only once no account holds 15 seats)
--   alter table public.profiles drop constraint profiles_classroom_seats_check;
--   alter table public.profiles add constraint profiles_classroom_seats_check
--     check (classroom_seats in (10, 20, 40, 80, 100));
