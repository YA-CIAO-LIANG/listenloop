-- Files no material uses any more (D161), for the daily clean-up: audio
-- in `speech` that no sentence and no saved version points to, and
-- recordings in `uploads` that no practice was made from (an upload that
-- was abandoned), older than `older_than`. Server only. Additive.
create function public.orphan_audio(older_than timestamptz, max_rows integer)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select 'speech'::text, o.name
    from storage.objects o
    where o.bucket_id = 'speech'
      and o.created_at < older_than
      and not exists (
        select 1 from public.practice_sentences s where s.audio_path = o.name
      )
      and not exists (
        select 1
        from public.practice_versions v,
          jsonb_array_elements(v.sentences) e
        where e ->> 'audio_path' = o.name
      )
    order by o.created_at
    limit max_rows
  )
  union all
  (
    select 'uploads'::text, o.name
    from storage.objects o
    where o.bucket_id = 'uploads'
      and o.created_at < older_than
      and not exists (
        select 1 from public.practices p where p.source_audio_path = o.name
      )
    order by o.created_at
    limit max_rows
  );
$$;
revoke all on function public.orphan_audio(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.orphan_audio(timestamptz, integer)
  to service_role;

-- How many files each bucket holds, for the clean-up's safety check.
create function public.storage_file_counts()
returns table (bucket text, files bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select bucket_id, count(*) from storage.objects
  where bucket_id in ('speech', 'uploads')
  group by bucket_id;
$$;
revoke all on function public.storage_file_counts()
  from public, anon, authenticated;
grant execute on function public.storage_file_counts() to service_role;

-- Rollback:
--   drop function public.storage_file_counts();
--   drop function public.orphan_audio(timestamptz, integer);
