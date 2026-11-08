-- News materials (D100) are rewritten in ListenLoop's own words from a
-- news release; the practice keeps where the facts came from, shown as
-- "rewritten from" on its page. Additive only: other practices leave
-- these empty.
alter table public.practices
add column source_name text check (char_length(source_name) between 1 and 100),
add column source_title text check (char_length(source_title) between 1 and 300),
add column source_url text check (
  source_url ~ '^https://' and char_length(source_url) <= 500
),
add constraint practices_source_complete check (
  (source_url is null) = (source_name is null)
  and (source_url is null) = (source_title is null)
);
