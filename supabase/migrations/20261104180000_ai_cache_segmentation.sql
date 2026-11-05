-- Sentence splitting by a language model is cached too (e+ 4, D35).
-- Widens the allowed kinds; existing rows are unaffected.
alter table public.ai_cache drop constraint ai_cache_kind_check;
alter table public.ai_cache
  add constraint ai_cache_kind_check
  check (kind in ('translation', 'notes', 'segmentation'));
