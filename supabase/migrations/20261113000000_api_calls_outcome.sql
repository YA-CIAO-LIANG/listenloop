-- What a successful call's answer amounted to (D123), e.g. "changed 5/7"
-- or "unchanged" for "revise with an instruction", so /admin/usage can
-- tell a call that worked but changed nothing from one that changed the
-- text. Additive: the column is nullable; older rows stay null.
alter table public.api_calls
  add column outcome text check (char_length(outcome) <= 40);
