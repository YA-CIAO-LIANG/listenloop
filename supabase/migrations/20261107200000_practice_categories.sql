-- Material categories and official drafts (D57).
--
-- 1. Where a practice belongs in lib/categories.ts: category, scenario,
--    general level, and for exam practice the exam and target. Set when
--    it's written by AI, or by an admin later; null for older ones.
-- 2. Official drafts: an official practice can wait as a draft
--    (published = false, kept private) until an admin publishes it. Only
--    published official practices must be public.
-- 3. sort_order: the library's order of official practices (lowest
--    first, then oldest); set by admins.

alter table public.practices
  add column category text check (char_length(category) between 1 and 40),
  add column scenario text check (char_length(scenario) between 1 and 60),
  add column level text check (level in ('beginner', 'intermediate', 'advanced')),
  add column exam text check (exam in ('toefl', 'ielts', 'toeic', 'gept')),
  add column exam_target text check (char_length(exam_target) between 1 and 40),
  add column published boolean not null default true,
  add column sort_order integer;

alter table public.practices drop constraint practices_official_is_public;
alter table public.practices
  add constraint practices_published_official_is_public
  check (not (official and published) or visibility = 'public');

-- Like `official`, the draft state and the library order are the admins'
-- to set (the server's secret key), not the author's own session.
create or replace function public.guard_official()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and (new.official or not new.published or new.sort_order is not null))
    or (tg_op = 'UPDATE' and (
      new.official is distinct from old.official
      or new.published is distinct from old.published
      or new.sort_order is distinct from old.sort_order
    )) then
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'only admins mark official practices';
    end if;
  end if;
  return new;
end;
$$;

create index practices_category on public.practices (category, exam);

grant select (category, scenario, level, exam, exam_target, published, sort_order)
  on public.practices to anon;
