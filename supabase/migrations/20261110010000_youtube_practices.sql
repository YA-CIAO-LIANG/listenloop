-- Practices from a YouTube video (D97): the learner pastes a link and the
-- video's transcript; the practice plays the video's own sound through the
-- embedded player (nothing is downloaded), so it has times instead of
-- audio files. Additive only: other practices leave these empty.
alter table public.practices
add column youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
add column youtube_channel text check (char_length(youtube_channel) <= 200),
add column youtube_license text check (
  youtube_license in ('youtube', 'creativeCommon')
),
add constraint practices_youtube_complete check (
  (youtube_id is null) = (youtube_license is null)
),
-- Only a Creative Commons video may be shared; the standard YouTube
-- license stays private (the uploader didn't allow reuse).
add constraint practices_youtube_public check (
  youtube_license is distinct from 'youtube' or visibility = 'private'
);

alter table public.practice_sentences
add column start_sec numeric(8, 2) check (start_sec >= 0),
add column end_sec numeric(8, 2) check (end_sec >= 0),
add constraint practice_sentences_times check (
  (start_sec is null) = (end_sec is null)
  and (end_sec is null or end_sec >= start_sec)
);
