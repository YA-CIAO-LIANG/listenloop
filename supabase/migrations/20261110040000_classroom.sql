-- Classroom (D103): teachers make classes, students join with a code,
-- teachers assign materials with dates and pass rules, post short
-- announcements, and see their students' progress on what they assigned.
-- Additive only. Privacy: students see only their own data and their
-- classes; a teacher sees only their classes, and students' progress only
-- for materials assigned to that class (class_progress below).

-- A teacher's class plan: how many students, set by an admin for now.
alter table public.profiles
add column classroom_seats integer check (
  classroom_seats in (10, 20, 40, 80, 100)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index classes_teacher on public.classes (teacher_id);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- What the teacher sees: the name the student gives this class.
  display_name text not null check (char_length(display_name) between 1 and 40),
  -- Under 18: they confirmed a parent or guardian agreed (terms).
  minor_consent boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_members_user on public.class_members (user_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  -- A built-in video id or "p-<uuid>" (a created practice).
  video_id text not null check (char_length(video_id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 200),
  starts_on date not null,
  due_on date not null check (due_on >= starts_on),
  -- The pass rules students should use (lib/pass-rules.ts); null: defaults.
  rules jsonb check (rules is null or jsonb_typeof(rules) = 'object'),
  created_at timestamptz not null default now()
);
create index assignments_class on public.assignments (class_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index announcements_class on public.announcements (class_id);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.announcements enable row level security;

-- Is the signed-in user a member of the class? (security definer so the
-- policies below don't recurse through class_members' own policy.)
create function public.is_class_member(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_members
    where class_id = target and user_id = (select auth.uid())
  );
$$;

create function public.is_class_teacher(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.classes
    where id = target and teacher_id = (select auth.uid())
  );
$$;

create policy "Teachers manage their classes" on public.classes
for all to authenticated
using (teacher_id = (select auth.uid()))
with check (teacher_id = (select auth.uid()));

create policy "Members read their classes" on public.classes
for select to authenticated
using (public.is_class_member(id));

create policy "Teachers read and remove their students" on public.class_members
for select to authenticated
using (public.is_class_teacher(class_id));

create policy "Teachers remove students" on public.class_members
for delete to authenticated
using (public.is_class_teacher(class_id));

create policy "Students read and leave their memberships" on public.class_members
for select to authenticated
using (user_id = (select auth.uid()));

create policy "Students leave a class" on public.class_members
for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Teachers manage assignments" on public.assignments
for all to authenticated
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

create policy "Members read assignments" on public.assignments
for select to authenticated
using (public.is_class_member(class_id));

create policy "Teachers manage announcements" on public.announcements
for all to authenticated
using (public.is_class_teacher(class_id))
with check (public.is_class_teacher(class_id));

create policy "Members read announcements" on public.announcements
for select to authenticated
using (public.is_class_member(class_id));

grant select, insert, update, delete on public.classes to authenticated;
grant select, delete on public.class_members to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.classes, public.class_members, public.assignments,
  public.announcements to service_role;

-- Joining with a code: checks the code and the class's seats (the
-- teacher's plan), then adds the signed-in user. Returns the class id,
-- or null when the code is wrong, the class is full, or it's archived.
create function public.join_class(
  code text, name text, consent boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  target public.classes;
  seats integer;
  taken integer;
begin
  if (select auth.uid()) is null then return null; end if;
  select * into target from public.classes
  where invite_code = upper(code) and archived_at is null;
  if target.id is null or target.teacher_id = (select auth.uid()) then
    return null;
  end if;
  select coalesce(p.classroom_seats, case when p.role = 'admin' then 100 end)
  into seats from public.profiles p where p.user_id = target.teacher_id;
  select count(*) into taken from public.class_members where class_id = target.id;
  if seats is null or taken >= seats then return null; end if;
  insert into public.class_members (class_id, user_id, display_name, minor_consent)
  values (target.id, (select auth.uid()), left(trim(name), 40), consent)
  on conflict (class_id, user_id) do update set display_name = excluded.display_name;
  return target.id;
end;
$$;
revoke all on function public.join_class(text, text, boolean) from public;
grant execute on function public.join_class(text, text, boolean) to authenticated;

-- The teacher's view of their students' progress: only their class,
-- only its students, only the materials assigned to it.
create function public.class_progress(target uuid)
returns table (user_id uuid, video_id text, data jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.user_id, p.video_id, p.data
  from public.progress p
  join public.class_members m on m.user_id = p.user_id and m.class_id = target
  where public.is_class_teacher(target)
    and p.video_id in (select a.video_id from public.assignments a where a.class_id = target);
$$;
revoke all on function public.class_progress(uuid) from public;
grant execute on function public.class_progress(uuid) to authenticated;
