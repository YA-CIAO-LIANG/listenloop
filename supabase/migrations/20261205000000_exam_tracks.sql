-- "Exam English" (D215): listening materials for Taiwan's senior high
-- English listening test ('hs-listening') and junior high's CAP ('cap').
-- Only widens the check; every existing row still passes ('gsat' stays
-- allowed for rows written before the move to 'hs-listening').
alter table public.practices drop constraint if exists practices_exam_check;
alter table public.practices
  add constraint practices_exam_check
  check (exam in ('toefl', 'ielts', 'toeic', 'gept', 'gsat', 'hs-listening', 'cap'));

-- Rollback: (only when no practice has exam 'hs-listening' or 'cap')
--   alter table public.practices drop constraint practices_exam_check;
--   alter table public.practices add constraint practices_exam_check
--   check (exam in ('toefl', 'ielts', 'toeic', 'gept', 'gsat'));
