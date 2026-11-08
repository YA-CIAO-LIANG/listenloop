-- Bilingual titles (D83): every material has an English and a Chinese
-- title, shown English first. `title` stays as it was (the one shown
-- before, and a fallback); the new columns are filled for every practice
-- and kept in step by the app.

alter table public.practices
  add column title_en text check (char_length(title_en) between 1 and 200),
  add column title_zh text check (char_length(title_zh) between 1 and 200);

-- Readable wherever the title is (public practices, column grants, D30).
grant select (title_en, title_zh) on public.practices to anon;
