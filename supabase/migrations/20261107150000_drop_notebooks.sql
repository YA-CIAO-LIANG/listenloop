-- Notebooks are removed (Joe, 2026-11-07; D53). Nothing else references
-- these tables: notebook_entries only points at notebooks. Production had
-- one test notebook with one entry when this ran.
drop table if exists public.notebook_entries;
drop table if exists public.notebooks;
