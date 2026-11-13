-- Personal data no longer needed is deleted (D159). Additive: prune_logs
-- gains two retention rules, run daily by the monitor (D156).
-- - beta_waitlist: emails of people without an account, 365 days after
--   they joined (invited or not; an invite lasts far less).
-- - intent_events: plan-interest clicks, 365 days.
create or replace function public.prune_logs() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.events where created_at < now() - interval '180 days';
  delete from public.shadowing_issues where created_at < now() - interval '365 days';
  delete from public.admin_audit where created_at < now() - interval '730 days';
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.error_logs where created_at < now() - interval '90 days';
  delete from public.ops_alerts where created_at < now() - interval '90 days';
  delete from public.health_checks where checked_at < now() - interval '30 days';
  delete from public.beta_waitlist where created_at < now() - interval '365 days';
  delete from public.intent_events where created_at < now() - interval '365 days';
$$;

-- Rollback:
--   Restore prune_logs from 20261123000000_ops_monitoring.sql.
