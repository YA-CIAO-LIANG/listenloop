-- Signed-in users read every practices column but the notes (D106); the
-- generation time (D142) is no secret either.
grant select (generation_seconds) on public.practices to authenticated;
