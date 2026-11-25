-- Quotas in words (D209). Additive only: it widens one check.
--
-- Practices one makes are counted in English words instead of minutes
-- (150 words a minute, lib/units.ts). Admins' quota changes are now
-- written in words ('wordsPerWeek', 'wordsPerMonth'); rows written in
-- minutes stay valid and are read as minutes × 150 (lib/quota.ts).

alter table public.quota_overrides
drop constraint if exists quota_overrides_limit_name_check;
alter table public.quota_overrides
add constraint quota_overrides_limit_name_check check (limit_name in (
  'minutesPerWeek', 'minutesPerMonth', 'wordsPerWeek', 'wordsPerMonth',
  'storageMegabytes', 'revisesPerDay'
));

-- Rollback: (only when no row names a words limit)
--   alter table public.quota_overrides
--   drop constraint if exists quota_overrides_limit_name_check;
--   alter table public.quota_overrides
--   add constraint quota_overrides_limit_name_check check (limit_name in (
--     'minutesPerWeek', 'minutesPerMonth', 'storageMegabytes', 'revisesPerDay'
--   ));
