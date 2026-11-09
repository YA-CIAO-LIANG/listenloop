-- A material's own credit (D118): who made the source, its license, and
-- what was changed, for official materials made from someone else's work
-- (a Blender open movie played through YouTube). When set, it's shown
-- instead of the credit built from the YouTube channel. Additive only.
alter table public.practices
add column attribution jsonb check (
  attribution is null or jsonb_typeof(attribution) = 'object'
);

-- Signed-in readers get it like the other public columns (D106: a column
-- added later needs its own grant).
grant select (attribution) on public.practices to authenticated;
