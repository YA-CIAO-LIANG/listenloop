-- Generated speech for practices (roadmap d3, docs/decisions.md D22).
-- One audio file per sentence, named by a hash of provider + voice + text,
-- so the same sentence in the same voice is generated only once and then
-- shared by every practice that uses it.

-- Public bucket: files are read by URL (cacheable, no signed URLs), and
-- a file's name can only be computed by someone who already knows its
-- text. No storage policies, so only the server (secret key) can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speech', 'speech', true, 5242880, array['audio/mpeg', 'audio/wav']);

-- The cache: which hashes already have a file. Server only.
create table public.speech_audio (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  path text not null check (path ~ '^[0-9a-f]{64}\.(mp3|wav)$'),
  mime_type text not null check (mime_type in ('audio/mpeg', 'audio/wav')),
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now()
);

alter table public.speech_audio enable row level security;
revoke all on public.speech_audio from anon, authenticated;

-- Each sentence's file in the bucket; null until generated.
alter table public.practice_sentences
add column audio_path text check (audio_path ~ '^[0-9a-f]{64}\.(mp3|wav)$');
