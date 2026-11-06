-- Totals for /admin/usage (D38), added up in the database so they stay
-- right past the API's row limit. Azure is told apart by provider id
-- ("azure-openai/…", "azure-tts/…"). Server only.
create function public.api_usage_totals(
  month_start timestamptz,
  day_start timestamptz
) returns table (
  today_micros bigint,
  today_calls bigint,
  month_micros bigint,
  month_azure_speech_chars bigint,
  azure_micros bigint
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(cost_micros) filter (where created_at >= day_start), 0)::bigint,
    count(*) filter (where created_at >= day_start),
    coalesce(sum(cost_micros) filter (where created_at >= month_start), 0)::bigint,
    coalesce(sum(chars) filter (
      where created_at >= month_start
        and operation = 'speech'
        and provider like 'azure-%'
    ), 0)::bigint,
    coalesce(sum(cost_micros) filter (where provider like 'azure-%'), 0)::bigint
  from public.api_calls;
$$;

revoke execute on function public.api_usage_totals from public, anon, authenticated;
grant execute on function public.api_usage_totals to service_role;
