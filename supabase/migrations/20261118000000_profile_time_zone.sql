-- The learner's time zone (D139), from their device, so dates the server
-- works out (reminders, pages it renders) follow their own clock. Only
-- the server writes it, like the rest of profiles. Additive only.
alter table public.profiles
add column time_zone text check (char_length(time_zone) between 1 and 64);
