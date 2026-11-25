-- Plans in three lines (D210): listening, writing, and both ("all"),
-- each in three tiers. Additive only: no row changes.
--
-- - profiles.plan may also be a listening or writing plan. The "all"
--   line keeps the ids it had ('student', 'paid' for Plus, 'pro'), so
--   every account on a paid plan is now on "all" without a change.
-- - A class plan has a line too (profiles.classroom_line), 'all' by
--   default: every class plan granted so far keeps everything it had.
-- - The waiting list remembers the line people chose.
-- - The fake doors' funnel records the "upgrade to all" prompt.
-- - Practicing shared materials in full is a listening feature: the
--   listening plans get it, as the "all" plans and class plans do.

alter table public.profiles drop constraint profiles_plan_check;
alter table public.profiles
add constraint profiles_plan_check check (plan in (
  'free', 'student', 'paid', 'pro',
  'listening-student', 'listening-plus', 'listening-pro',
  'writing-student', 'writing-plus', 'writing-pro'
));

alter table public.profiles
add column if not exists classroom_line text not null default 'all'
  check (classroom_line in ('listening', 'writing', 'all'));

alter table public.waitlist
add column if not exists plan_line text
  check (plan_line in ('listening', 'writing', 'all'));

alter table public.intent_events drop constraint if exists intent_events_step_check;
alter table public.intent_events
add constraint intent_events_step_check check (
  step in (
    'pricing_view',
    'interval_switch',
    'subscribe_click',
    'waitlist_join',
    'unlock_click',
    'upsell_view'
  )
);

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
                  or f.plan in (
                    'paid', 'student', 'pro',
                    'listening-student', 'listening-plus', 'listening-pro'
                  )
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


-- Rollback: (only when no account is on a listening or writing plan, and
-- no funnel row is an 'upsell_view')
--   alter table public.profiles drop constraint profiles_plan_check;
--   alter table public.profiles
--   add constraint profiles_plan_check check (plan in ('free', 'paid', 'student', 'pro'));
--   alter table public.profiles drop column classroom_line;
--   alter table public.waitlist drop column plan_line;
--   alter table public.intent_events drop constraint intent_events_step_check;
--   alter table public.intent_events add constraint intent_events_step_check
--   check (step in ('pricing_view', 'interval_switch', 'subscribe_click',
--     'waitlist_join', 'unlock_click'));
--   and the can_practice of 20261201000000_student_plan.sql.
