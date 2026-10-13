-- Trusted server-side logic. All privileged functions are SECURITY DEFINER with an
-- empty search_path and fully-qualified names. Callers never supply reporter ids,
-- normalized prices, statuses or protected timestamps.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.today_algeria()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Africa/Algiers')::date $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'
  )
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin', 'moderator')
  )
$$;

create or replace function public.unit_dimension_of(p_unit public.unit_code)
returns public.unit_dimension
language sql
immutable
set search_path = ''
as $$
  select case p_unit
    when 'g' then 'mass'::public.unit_dimension
    when 'kg' then 'mass'::public.unit_dimension
    when 'ml' then 'volume'::public.unit_dimension
    when 'l' then 'volume'::public.unit_dimension
    else 'count'::public.unit_dimension
  end
$$;

-- Trusted unit-price normalization. 180 DZD for 2 kg -> 90.00 DZD/kg.
-- round() on numeric rounds half away from zero (= half up for positive prices).
create or replace function public.normalize_price(p_price numeric, p_quantity numeric, p_unit public.unit_code)
returns table (comparison_unit public.unit_code, normalized_price numeric)
language sql
immutable
set search_path = ''
as $$
  select
    case p_unit when 'g' then 'kg' when 'kg' then 'kg' when 'ml' then 'l' when 'l' then 'l' else 'piece' end::public.unit_code,
    round(p_price / (case p_unit when 'g' then p_quantity / 1000 when 'ml' then p_quantity / 1000 else p_quantity end), 2)
$$;

-- ---------------------------------------------------------------------------
-- New users get a private profile row.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Contribution
-- Limits are documented in docs/SECURITY.md. Rate limits are counted in the
-- database, so they hold across any number of serverless instances.
-- ---------------------------------------------------------------------------
create or replace function public.submit_price_report(
  p_product_id text,
  p_shop_id uuid,
  p_price numeric,
  p_quantity numeric,
  p_unit public.unit_code,
  p_observed_on date
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

  if p_product_id is null or p_shop_id is null or p_price is null or p_quantity is null or p_unit is null or p_observed_on is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select * into v_product from public.products p where p.id = p_product_id and p.is_active;
  if not found then
    raise exception 'unknown_product' using errcode = '22023';
  end if;

  -- Community reports are only accepted for real (non-demo), active locations.
  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.is_active and not s.is_demo) then
    raise exception 'unknown_shop' using errcode = '22023';
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

  -- No future dates; observations older than 30 days are not accepted as new reports.
  if p_observed_on > v_today or p_observed_on < v_today - 30 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  select n.normalized_price, n.comparison_unit into v_norm, v_cunit
  from public.normalize_price(p_price, p_quantity, p_unit) n;

  if v_norm < v_product.min_unit_price or v_norm > v_product.max_unit_price then
    raise exception 'implausible_price' using errcode = '22023';
  end if;

  -- Serialize submissions per user so concurrent requests cannot bypass the limits.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 42));

  if (select count(*) from public.price_reports r
      where r.contributor_id = v_uid and r.submitted_at > now() - interval '10 minutes') >= 10
     or (select count(*) from public.price_reports r
      where r.contributor_id = v_uid and r.submitted_at > now() - interval '24 hours') >= 60 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;

  if exists (
    select 1 from public.price_reports r
    where r.contributor_id = v_uid and r.product_id = p_product_id and r.shop_id = p_shop_id
      and r.observed_on = p_observed_on and r.status <> 'rejected'
  ) then
    raise exception 'duplicate_report' using errcode = '23505';
  end if;

  insert into public.price_reports (
    product_id, shop_id, contributor_id, price, quantity, unit, comparison_unit, normalized_price,
    observed_on, status, source
  ) values (
    p_product_id, p_shop_id, v_uid, p_price, p_quantity, p_unit, v_cunit, v_norm,
    p_observed_on, 'pending', 'community'
  )
  returning price_reports.id into v_id;

  return query select v_id, 'pending'::public.report_status, v_norm, v_cunit;
exception
  when unique_violation then
    raise exception 'duplicate_report' using errcode = '23505';
end;
$$;

-- A contributor's own reports, including pending and rejected ones.
create or replace function public.my_price_reports(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, product_id text, shop_id uuid, price numeric, quantity numeric, unit public.unit_code,
  normalized_price numeric, comparison_unit public.unit_code, observed_on date, submitted_at timestamptz,
  status public.report_status, rejection_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.product_id, r.shop_id, r.price, r.quantity, r.unit, r.normalized_price, r.comparison_unit,
         r.observed_on, r.submitted_at, r.status, r.rejection_reason
  from public.price_reports r
  where auth.uid() is not null and r.contributor_id = auth.uid()
  order by r.submitted_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- ---------------------------------------------------------------------------
-- Flags (abuse reports on public observations)
-- ---------------------------------------------------------------------------
create or replace function public.flag_price_report(p_report_id uuid, p_reason public.flag_reason, p_note text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;
  if p_note is not null and char_length(p_note) > 300 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.price_reports r where r.id = p_report_id and r.status = 'approved') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 43));
  if (select count(*) from public.report_flags f where f.flagged_by = v_uid and f.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;
  insert into public.report_flags (report_id, flagged_by, reason, note)
  values (p_report_id, v_uid, p_reason, nullif(btrim(p_note), ''))
  on conflict (report_id, flagged_by) do nothing;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation (admin / moderator only, enforced here — not in the UI)
-- ---------------------------------------------------------------------------
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
  select r.id, r.product_id, r.shop_id, s.name, r.contributor_id, r.price, r.quantity, r.unit,
         r.normalized_price, r.comparison_unit, r.observed_on, r.submitted_at, r.status,
         (select count(*)::integer from public.report_flags f where f.report_id = r.id and f.resolved_at is null),
         (select count(*)::integer from public.price_reports o where o.contributor_id = r.contributor_id)
  from public.price_reports r
  join public.shops s on s.id = r.shop_id
  where r.status = p_status
    and (not p_flagged_only or exists (select 1 from public.report_flags f where f.report_id = r.id and f.resolved_at is null))
  order by r.submitted_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.moderate_price_report(p_report_id uuid, p_decision text, p_note text default null)
returns public.report_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_from public.report_status;
  v_to public.report_status;
begin
  if not public.is_moderator() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') or (p_note is not null and char_length(p_note) > 300) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select r.status into v_from from public.price_reports r where r.id = p_report_id for update;
  if not found then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_to := case p_decision when 'approve' then 'approved' else 'rejected' end;
  -- Allowed transitions: pending -> approved|rejected, approved -> rejected, rejected -> approved.
  if v_from = v_to then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  update public.price_reports r
     set status = v_to,
         moderated_at = now(),
         moderated_by = v_uid,
         rejection_reason = case when v_to = 'rejected' then nullif(btrim(p_note), '') else null end
   where r.id = p_report_id;

  update public.report_flags f set resolved_at = now() where f.report_id = p_report_id and f.resolved_at is null;

  insert into public.moderation_events (report_id, actor_id, action, from_status, to_status, note)
  values (p_report_id, v_uid, p_decision, v_from, v_to, nullif(btrim(p_note), ''));
  return v_to;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public read API
-- ---------------------------------------------------------------------------

-- Only approved observations at active shops. Contributor identities are never exposed.
-- corroborating_reports counts DISTINCT other contributors whose approved reports for the
-- same product and shop are within 3 days and 5 % of this price.
create view public.public_price_observations
with (security_barrier = true)
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
  (s.is_demo or r.source = 'demo') as is_demo,
  (
    select count(distinct o.contributor_id)::integer
    from public.price_reports o
    where o.product_id = r.product_id
      and o.shop_id = r.shop_id
      and o.status = 'approved'
      and o.id <> r.id
      and o.contributor_id is not null
      and r.contributor_id is not null
      and o.contributor_id <> r.contributor_id
      and abs(o.observed_on - r.observed_on) <= 3
      and abs(o.normalized_price - r.normalized_price) <= r.normalized_price * 0.05
  ) as corroborating_reports
from public.price_reports r
join public.shops s on s.id = r.shop_id
where r.status = 'approved' and s.is_active;

-- Parameterized catalogue search (no string-built filters).
create or replace function public.search_products(p_query text, p_limit integer default 20)
returns setof public.products
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.products p
  where p.is_active
    and char_length(btrim(coalesce(p_query, ''))) between 1 and 80
    and strpos(
      lower(p.name_en || ' ' || p.name_fr || ' ' || p.name_ar || ' ' || coalesce(p.variant_en, '') || ' '
            || coalesce(p.variant_fr, '') || ' ' || array_to_string(p.search_terms, ' ')),
      lower(btrim(p_query))
    ) > 0
  order by (lower(p.name_en) = lower(btrim(p_query))) desc, p.name_en
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- Honest coverage figures for an area (counts real and demo separately).
create or replace function public.area_coverage(p_wilaya smallint)
returns table (
  shop_count integer, demo_shop_count integer, shops_with_reports integer,
  approved_reports integer, demo_reports integer, last_observed_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.shops s where s.wilaya_code = p_wilaya and s.is_active and not s.is_demo),
    (select count(*)::integer from public.shops s where s.wilaya_code = p_wilaya and s.is_active and s.is_demo),
    (select count(distinct r.shop_id)::integer from public.price_reports r join public.shops s on s.id = r.shop_id
       where s.wilaya_code = p_wilaya and s.is_active and r.status = 'approved' and not s.is_demo and r.source <> 'demo'),
    (select count(*)::integer from public.price_reports r join public.shops s on s.id = r.shop_id
       where s.wilaya_code = p_wilaya and s.is_active and r.status = 'approved' and not s.is_demo and r.source <> 'demo'),
    (select count(*)::integer from public.price_reports r join public.shops s on s.id = r.shop_id
       where s.wilaya_code = p_wilaya and s.is_active and r.status = 'approved' and (s.is_demo or r.source = 'demo')),
    (select max(r.observed_on) from public.price_reports r join public.shops s on s.id = r.shop_id
       where s.wilaya_code = p_wilaya and s.is_active and r.status = 'approved')
$$;

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger shops_touch before update on public.shops for each row execute function public.touch_updated_at();
create trigger saved_lists_touch before update on public.saved_lists for each row execute function public.touch_updated_at();
