-- How long getting a practice ready actually took (D142): from pressing
-- "Generate audio" to notes and audio done, measured in the browser. The
-- site's recent median per sentence becomes the estimate shown before the
-- next one starts. Add-only; written by the server (secret key) for the
-- practice's own author.
alter table public.practices
  add column if not exists generation_seconds real
    check (generation_seconds is null or (generation_seconds > 0 and generation_seconds <= 3600));
