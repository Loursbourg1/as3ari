-- Fix: handle custom products in submit_report_with_location,
--      and create Supabase Storage bucket for report photos.

-- ── 1. Storage bucket ────────────────────────────────────────────────────────
-- Creates a public bucket for community price-report photos.
-- Wrapped in a DO block so it degrades gracefully when the storage extension
-- is not present (e.g., in the PGlite test harness).

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'report-photos',
      'report-photos',
      true,
      2097152,
      array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    )
    on conflict (id) do update
      set public = true,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'report_photos_insert'
    ) then
      execute $pol$
        create policy report_photos_insert on storage.objects
          for insert to authenticated
          with check (
            bucket_id = 'report-photos'
            and (storage.foldername(name))[1] = auth.uid()::text
          )
      $pol$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'report_photos_read'
    ) then
      execute $pol$
        create policy report_photos_read on storage.objects
          for select to anon, authenticated
          using (bucket_id = 'report-photos')
      $pol$;
    end if;
  end if;
end;
$$;

-- ── 2. Updated submit_report_with_location function ──────────────────────────
-- Adds p_custom_product_name / p_custom_product_category so custom products
-- created on the frontend can be upserted into public.products before the
-- price report is recorded.

create or replace function public.submit_report_with_location(
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
  p_custom_product_category text default null
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
  v_cat text;
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

  -- Handle custom products (id starts with 'cust-')
  if left(p_product_id, 5) = 'cust-' then
    if p_custom_product_name is null or char_length(btrim(p_custom_product_name)) < 2 then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    -- Resolve category, fall back to 'pantry'
    v_cat := coalesce(
      nullif(btrim(coalesce(p_custom_product_category, '')), ''),
      'pantry'
    );
    if not exists (select 1 from public.categories c where c.id = v_cat) then
      v_cat := 'pantry';
    end if;
    -- Upsert the custom product so it exists for this and future reports
    insert into public.products (
      id, category_id, name_en, name_fr, name_ar,
      dimension, min_unit_price, max_unit_price, is_active
    ) values (
      p_product_id, v_cat,
      btrim(p_custom_product_name), btrim(p_custom_product_name), btrim(p_custom_product_name),
      -- Infer dimension from unit
      case
        when p_unit in ('g', 'kg') then 'mass'::public.unit_dimension
        when p_unit in ('ml', 'l') then 'volume'::public.unit_dimension
        else 'count'::public.unit_dimension
      end,
      0.01, 1000000, true
    )
    on conflict (id) do update
      set is_active = true;
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

  -- Skip plausibility check for custom products (no defined bounds)
  if left(p_product_id, 5) <> 'cust-' then
    if v_norm < v_product.min_unit_price or v_norm > v_product.max_unit_price then
      raise exception 'implausible_price' using errcode = '22023';
    end if;
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
  text, numeric, numeric, public.unit_code, date, text, numeric, numeric, text, boolean, text, text, text
) to authenticated;
