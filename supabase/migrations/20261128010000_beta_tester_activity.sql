-- The admin's Beta test page (D165): each account that joined with an
-- invite, its practice progress in brief, and when it was last active.
-- Read with the secret key only; no answers, scores, or email leave here.
create or replace function public.beta_tester_activity(invite uuid default null)
returns table (
  user_id uuid,
  number bigint,
  invite_id uuid,
  invite_note text,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  last_activity timestamptz,
  progress jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.user_id,
    p.number,
    u.invite_id,
    i.note,
    u.used_at,
    a.last_sign_in_at,
    greatest(
      (select max(g.updated_at) from public.progress g where g.user_id = u.user_id),
      (select max(d.updated_at) from public.user_documents d where d.user_id = u.user_id)
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'video', g.video_id,
        'week', g.data -> 'week',
        'status', g.data -> 'status',
        'done', (
          select coalesce(jsonb_agg(k.key::int order by k.key::int), '[]'::jsonb)
          from jsonb_each(coalesce(g.data -> 'days', '{}'::jsonb)) k
          where k.key ~ '^[1-7]$' and (k.value ->> 'done')::boolean is true
        ),
        'weeks', jsonb_array_length(coalesce(g.data -> 'history', '[]'::jsonb)),
        'updated', g.updated_at
      ) order by g.updated_at desc)
      from public.progress g
      where g.user_id = u.user_id
    ), '[]'::jsonb)
  from public.beta_invite_uses u
  join public.beta_invites i on i.id = u.invite_id
  left join public.profiles p on p.user_id = u.user_id
  left join auth.users a on a.id = u.user_id
  where invite is null or u.invite_id = invite
  order by u.used_at desc
$$;

revoke all on function public.beta_tester_activity(uuid) from public, anon, authenticated;
grant execute on function public.beta_tester_activity(uuid) to service_role;

-- Rollback:
--   drop function public.beta_tester_activity(uuid);
