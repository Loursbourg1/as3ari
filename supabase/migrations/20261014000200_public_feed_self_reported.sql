-- Latest view used INNER JOIN shops, so approved reports with shop_id NULL never went public.
-- security_invoker=false: anon can read approved rows. is_demo is never NULL (eq false must match).

drop view if exists public.public_price_observations;

create view public.public_price_observations
with (security_barrier = true, security_invoker = false)
as
select
  r.id,
  r.product_id,
  r.shop_id,
  s.wilaya_code,
  s.area_id,
  r.price,
  r.quantity,
  r.unit,
  r.normalized_price,
  r.comparison_unit,
  r.observed_on,
  r.submitted_at,
  r.source,
  (coalesce(s.is_demo, false) or r.source = 'demo') as is_demo,
  (
    select count(distinct o.contributor_id)::integer
    from public.price_reports o
    where o.product_id = r.product_id
      and (o.shop_id = r.shop_id or (r.shop_id is null and o.location_label = r.location_label))
      and o.status = 'approved'
      and o.id <> r.id
      and o.contributor_id is not null
      and r.contributor_id is not null
      and o.contributor_id <> r.contributor_id
      and abs(o.observed_on - r.observed_on) <= 3
      and abs(o.normalized_price - r.normalized_price) <= r.normalized_price * 0.05
  ) as corroborating_reports,
  r.photo_url,
  coalesce(r.lat, s.lat) as lat,
  coalesce(r.lng, s.lng) as lng,
  coalesce(r.location_label, s.name) as location_label,
  r.is_anonymous,
  case
    when r.is_anonymous then null
    else coalesce(r.reporter_name, p.display_name, 'Contributor')
  end as reporter_name
from public.price_reports r
left join public.shops s on s.id = r.shop_id
left join public.profiles p on p.id = r.contributor_id
where r.status = 'approved' and (s.id is null or s.is_active);

grant select on public.public_price_observations to anon, authenticated;
