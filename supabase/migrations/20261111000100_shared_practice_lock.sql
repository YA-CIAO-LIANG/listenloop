-- Shared materials are for paying plans (D106), part 2 of 2: applied after
-- the app reads notes through practice_notes and lists through
-- public_practice_readiness (part 1).

-- Weeks already under way now may be finished (can_practice).
insert into public.shared_practice_grants (user_id, practice_id, week, started_at)
select pr.user_id, p.id, (pr.data ->> 'week')::integer, pr.data ->> 'startedAt'
from public.progress pr
join public.practices p on pr.video_id = 'p-' || p.id::text
where not p.official
  and p.user_id <> pr.user_id
  and (pr.data ->> 'week') ~ '^[0-9]{1,4}$'
  and pr.data ? 'startedAt'
  and coalesce(pr.data ->> 'status', 'in-progress') = 'in-progress'
on conflict do nothing;

-- Sentences and earlier versions: only for those who may practice.
drop policy "Sentences of public practices" on public.practice_sentences;
create policy "Sentences of practicable practices" on public.practice_sentences
for select to anon, authenticated
using (public.can_practice(practice_id));

drop policy "Versions of public practices" on public.practice_versions;
drop policy "Versions of readable practices" on public.practice_versions;
create policy "Versions of practicable practices" on public.practice_versions
for select to anon, authenticated
using (public.can_practice(practice_id));

-- The practice-wide notes go through practice_notes, never a plain read:
-- every column but vocab and grammar stays readable (row level security
-- still decides which rows). A column added to practices later needs its
-- own grant to authenticated (and to anon, if signed-out pages read it).
revoke select (vocab, grammar) on public.practices from anon;
revoke select on public.practices from authenticated;
grant select (
  id, user_id, collection_id, title, title_en, title_zh, subtitle,
  source_language, voice, voice_b, visibility, official, published,
  sort_order, category, categories, scenario, level, exam, exam_target,
  notes_generated_at, removed_at, removed_reason, version, created_at,
  updated_at, estimated_seconds, duration_sec, youtube_id, youtube_channel,
  youtube_license, source_name, source_title, source_url
) on public.practices to authenticated;

