-- Self-reported prices have shop_id NULL. The inner join hid them from mods.

create or replace function public.moderation_queue(
  p_status public.report_status default 'pending',
  p_flagged_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, product_id text, shop_id uuid, shop_name text, contributor_id uuid, price numeric, quantity numeric,
  unit public.unit_code, normalized_price numeric, comparison_unit public.unit_code, observed_on date,
  submitted_at timestamptz, status public.report_status, open_flags integer, contributor_report_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select r.id, r.product_id, r.shop_id, coalesce(s.name, r.location_label, ''), r.contributor_id, r.price, r.quantity, r.unit,
         r.normalized_price, r.comparison_unit, r.observed_on, r.submitted_at, r.status,
         (select count(*)::integer from public.report_flags f where f.report_id = r.id and f.resolved_at is null),
         (select count(*)::integer from public.price_reports o where o.contributor_id = r.contributor_id)
  from public.price_reports r
  left join public.shops s on s.id = r.shop_id
  where r.status = p_status
    and (not p_flagged_only or exists (select 1 from public.report_flags f where f.report_id = r.id and f.resolved_at is null))
  order by r.submitted_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
