-- GSAT-style listening (D213): the exam column also allows 'gsat'.
-- Only widens the check; every existing row still passes.
alter table public.practices drop constraint if exists practices_exam_check;
alter table public.practices
  add constraint practices_exam_check
  check (exam in ('toefl', 'ielts', 'toeic', 'gept', 'gsat'));

-- Rollback: (only when no practice has exam = 'gsat')
--   alter table public.practices drop constraint practices_exam_check;
--   alter table public.practices add constraint practices_exam_check
--   check (exam in ('toefl', 'ielts', 'toeic', 'gept'));
