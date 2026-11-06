-- Fix (D44): signed-out visitors couldn't read snapshots of public
-- practices, because the read policy also checked practices.user_id,
-- a column anon may not select (column grants, D30). Two policies now:
-- anon checks visibility only; signed-in users also see their own.
drop policy "Versions of readable practices" on public.practice_versions;

create policy "Versions of public practices" on public.practice_versions
for select to anon
using (
  exists (
    select 1 from public.practices p
    where p.id = practice_id and p.visibility = 'public'
  )
);

create policy "Versions of readable practices" on public.practice_versions
for select to authenticated
using (
  exists (
    select 1 from public.practices p
    where p.id = practice_id
      and (p.visibility = 'public' or p.user_id = (select auth.uid()))
  )
);
