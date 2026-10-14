-- Retain the submitter-selected geography so self-reports appear in the correct feeds.
alter table public.price_reports
  add column if not exists location_wilaya_code smallint references public.wilayas(code),
  add column if not exists location_area_id text references public.local_areas(id);

-- Keep the established validation/submission path; attach trusted form geography atomically.
create or replace function public.submit_report_with_location_and_region(
  p_product_id text,
  p_price numeric,
  p_quantity numeric,
  p_unit public.unit_code,
  p_observed_on date,
  p_location_label text,
  p_lat numeric default null,
  p_lng numeric default null,
  p_photo_url text default null,
  p_is_anonymous boolean default true,
  p_reporter_name text default null,
  p_custom_product_name text default null,
  p_custom_product_category text default null,
  p_wilaya_code smallint default null,
  p_area_id text default null
)
returns table (id uuid, status public.report_status, normalized_price numeric, comparison_unit public.unit_code)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_report record;
begin
  if p_area_id is not null and not exists (
    select 1 from public.local_areas a
    where a.id = p_area_id and (p_wilaya_code is null or a.wilaya_code = p_wilaya_code)
  ) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select * into v_report
  from public.submit_report_with_location(
    p_product_id, p_price, p_quantity, p_unit, p_observed_on, p_location_label,
    p_lat, p_lng, p_photo_url, p_is_anonymous, p_reporter_name,
    p_custom_product_name, p_custom_product_category
  );

  update public.price_reports r
  set location_wilaya_code = p_wilaya_code,
      location_area_id = p_area_id
  where r.id = v_report.id and r.contributor_id = auth.uid();

  return query select v_report.id, v_report.status, v_report.normalized_price, v_report.comparison_unit;
end;
$$;

grant execute on function public.submit_report_with_location_and_region(
  text, numeric, numeric, public.unit_code, date, text, numeric, numeric, text, boolean, text, text, text, smallint, text
) to authenticated;

-- Preserve public read access while carrying exact submitted region/commune metadata.
drop view if exists public.public_price_observations;
create view public.public_price_observations
with (security_barrier = true, security_invoker = false)
as
select
  r.id,
  r.product_id,
  r.shop_id,
  coalesce(
    s.wilaya_code,
    r.location_wilaya_code,
    (
      select w.code from public.wilayas w
      where r.lat is not null and r.lng is not null and w.center_lat is not null
      order by
        (w.center_lat::double precision - r.lat::double precision) ^ 2
        + (cos(r.lat::double precision * pi() / 180.0)
          * (w.center_lng::double precision - r.lng::double precision)) ^ 2
      limit 1
    ),
    (
      select a.wilaya_code from public.local_areas a
      where lower(btrim(r.location_label)) in (lower(a.name_en), lower(a.name_fr), lower(a.name_ar))
      order by a.wilaya_code limit 1
    ),
    (
      select w.code from public.wilayas w
      where lower(btrim(r.location_label)) in (lower(w.name_en), lower(w.name_fr), lower(w.name_ar))
      order by w.code limit 1
    ),
    (select w.code from public.wilayas w order by w.code limit 1)
  ) as wilaya_code,
  coalesce(
    s.area_id,
    r.location_area_id,
    (
      select a.id from public.local_areas a
      where lower(btrim(r.location_label)) in (lower(a.name_en), lower(a.name_fr), lower(a.name_ar))
      order by a.id limit 1
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
  case when r.is_anonymous then null else coalesce(r.reporter_name, p.display_name, 'Contributor') end as reporter_name
from public.price_reports r
left join public.shops s on s.id = r.shop_id
left join public.profiles p on p.id = r.contributor_id
where r.status = 'approved' and (s.id is null or s.is_active);

grant select on public.public_price_observations to anon, authenticated;

-- Notify all open clients on approval without exposing any report or contributor fields.
create or replace function public.notify_approved_price_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('type', 'price_report_approved'), 'approved', 'public-price-reports', false);
  return new;
end;
$$;

create trigger price_report_approved_broadcast
after update of status on public.price_reports
for each row
when (old.status is distinct from new.status and new.status = 'approved')
execute function public.notify_approved_price_report();
