-- The student plan gets its own id (D207): Plus at a student price with
-- its own AI writing allowances (lib/plans.ts PLANS.student). An admin
-- sets it like Plus and Pro; it may practice shared materials like the
-- other paying plans. Only widens what's allowed: no data changes.
alter table public.profiles drop constraint profiles_plan_check;
alter table public.profiles
add constraint profiles_plan_check check (plan in ('free', 'paid', 'student', 'pro'));

create or replace function public.can_practice(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.practices p
    where p.id = target
      and (
        p.user_id = (select auth.uid())
        or (
          p.visibility = 'public'
          and p.removed_at is null
          and (
            p.official
            or exists (
              select 1 from public.profiles f
              where f.user_id = (select auth.uid())
                and f.status = 'active'
                and (
                  f.role = 'admin'
                  or f.plan in ('paid', 'student', 'pro')
                  or f.classroom_seats is not null
                )
            )
            or exists (
              select 1 from public.assignments a
              join public.class_members m on m.class_id = a.class_id
              where m.user_id = (select auth.uid())
                and a.video_id = 'p-' || p.id::text
            )
            or exists (
              select 1 from public.shared_practice_grants g
              join public.progress pr
                on pr.user_id = g.user_id
                and pr.video_id = 'p-' || g.practice_id::text
              where g.user_id = (select auth.uid())
                and g.practice_id = p.id
                and g.created_at > now() - interval '60 days'
                and pr.data ->> 'week' = g.week::text
                and pr.data ->> 'startedAt' = g.started_at
                and coalesce(pr.data ->> 'status', 'in-progress') = 'in-progress'
            )
          )
        )
      )
  );
$$;

-- Rollback:
--   update public.profiles set plan = 'paid' where plan = 'student';
--   alter table public.profiles drop constraint profiles_plan_check;
--   alter table public.profiles
--   add constraint profiles_plan_check check (plan in ('free', 'paid', 'pro'));
--   and can_practice as in 20261111000000_shared_practice_access.sql
--   (f.plan in ('paid', 'pro')).
