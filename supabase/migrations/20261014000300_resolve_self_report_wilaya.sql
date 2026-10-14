-- Preserve a self-reported observation's geographic filter even though it has no shop row.
-- Prefer its GPS position, then an exact localized commune/wilaya name, and finally the
-- first configured wilaya for older reports with neither source of location metadata.
create or replace view public.public_price_observations
with (security_barrier = true, security_invoker = false)
as
select
  r.id,
  r.product_id,
  r.shop_id,
  coalesce(
    s.wilaya_code,
    (
      select w.code
      from public.wilayas w
      where r.lat is not null and r.lng is not null and w.center_lat is not null
      order by
        (w.center_lat::double precision - r.lat::double precision) ^ 2
        + (cos(r.lat::double precision * pi() / 180.0)
          * (w.center_lng::double precision - r.lng::double precision)) ^ 2
      limit 1
    ),
    (
      select a.wilaya_code
      from public.local_areas a
      where lower(btrim(r.location_label)) in (lower(a.name_en), lower(a.name_fr), lower(a.name_ar))
      order by a.wilaya_code
      limit 1
    ),
    (
      select w.code
      from public.wilayas w
      where lower(btrim(r.location_label)) in (lower(w.name_en), lower(w.name_fr), lower(w.name_ar))
      order by w.code
      limit 1
    ),
    (select w.code from public.wilayas w order by w.code limit 1)
  ) as wilaya_code,
  coalesce(
    s.area_id,
    (
      select a.id
      from public.local_areas a
      where lower(btrim(r.location_label)) in (lower(a.name_en), lower(a.name_fr), lower(a.name_ar))
      order by a.id
      limit 1
    )
  ) as area_id,
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
