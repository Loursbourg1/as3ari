-- Self-reported locations & contributor photos support

alter table public.price_reports
  add column if not exists location_label text check (char_length(location_label) <= 120),
  add column if not exists lat numeric(9, 6) check (lat between -90 and 90),
  add column if not exists lng numeric(9, 6) check (lng between -180 and 180),
  add column if not exists photo_url text;

-- Allow shop_id to be nullable for direct self-reported locations
alter table public.price_reports
  alter column shop_id drop not null;

-- Recreate view to include contributor photos and self-reported location details
create or replace view public.public_price_observations
with (security_barrier = true)
as
select
  r.id,
  r.product_id,
  r.shop_id,
  coalesce(s.wilaya_code, (select code from public.wilayas limit 1)) as wilaya_code,
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
  coalesce(r.location_label, s.name) as location_label
from public.price_reports r
left join public.shops s on s.id = r.shop_id
where r.status = 'approved' and (s.id is null or s.is_active);

-- RPC for submitting reports with user-defined locations & photos
create or replace function public.submit_report_with_location(
  p_product_id text,
  p_price numeric,
  p_quantity numeric,
  p_unit public.unit_code,
  p_observed_on date,
  p_location_label text,
  p_lat numeric default null,
  p_lng numeric default null,
  p_photo_url text default null
)
returns table (id uuid, status public.report_status, normalized_price numeric, comparison_unit public.unit_code)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_today date := public.today_algeria();
  v_norm numeric;
  v_cunit public.unit_code;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;

  if p_product_id is null or p_price is null or p_quantity is null or p_unit is null or p_observed_on is null or p_location_label is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if char_length(btrim(p_location_label)) < 2 then
    raise exception 'missing_location' using errcode = '22023';
  end if;

  select * into v_product from public.products p where p.id = p_product_id and p.is_active;
  if not found then
    raise exception 'unknown_product' using errcode = '22023';
  end if;

  if public.unit_dimension_of(p_unit) <> v_product.dimension then
    raise exception 'unit_mismatch' using errcode = '22023';
  end if;

  if p_price <= 0 or p_price > 1000000 or p_price <> round(p_price, 2) then
    raise exception 'invalid_price' using errcode = '22023';
  end if;

  if not (
    (p_unit in ('g', 'ml') and p_quantity between 1 and 100000)
    or (p_unit in ('kg', 'l') and p_quantity between 0.001 and 100)
    or (p_unit = 'piece' and p_quantity between 1 and 1000 and p_quantity = trunc(p_quantity))
  ) or p_quantity <> round(p_quantity, 3) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_observed_on > v_today or p_observed_on < v_today - 30 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  select n.normalized_price, n.comparison_unit into v_norm, v_cunit
  from public.normalize_price(p_price, p_quantity, p_unit) n;

  if v_norm < v_product.min_unit_price or v_norm > v_product.max_unit_price then
    raise exception 'implausible_price' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 42));

  if (select count(*) from public.price_reports r
      where r.contributor_id = v_uid and r.submitted_at > now() - interval '10 minutes') >= 10
     or (select count(*) from public.price_reports r
      where r.contributor_id = v_uid and r.submitted_at > now() - interval '24 hours') >= 60 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  insert into public.price_reports (
    product_id, shop_id, contributor_id, price, quantity, unit, comparison_unit, normalized_price,
    observed_on, status, source, location_label, lat, lng, photo_url
  ) values (
    p_product_id, null, v_uid, p_price, p_quantity, p_unit, v_cunit, v_norm,
    p_observed_on, 'pending', 'community', btrim(p_location_label), p_lat, p_lng, p_photo_url
  )
  returning price_reports.id into v_id;

  return query select v_id, 'pending'::public.report_status, v_norm, v_cunit;
end;
$$;

grant execute on function public.submit_report_with_location(
  text, numeric, numeric, public.unit_code, date, text, numeric, numeric, text
) to authenticated;

