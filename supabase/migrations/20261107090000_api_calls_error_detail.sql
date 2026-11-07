-- What a failed provider call answered (D49): the HTTP status and the
-- provider's short error code ("DeploymentNotFound", "timeout"), so
-- /admin/usage can tell a wrong key from a missing deployment. Never a
-- key or the text sent. Additive: both columns are nullable.
alter table public.api_calls
  add column http_status integer,
  add column error_code text check (char_length(error_code) <= 60);
