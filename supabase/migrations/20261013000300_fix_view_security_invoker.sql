-- Fix 403 on public_price_observations for anon users.
--
-- The view was created with security_barrier=true but no security_invoker=false
-- override, so in newer PostgreSQL/Supabase it runs as the calling role (anon).
-- Anon has no SELECT on price_reports, causing 403.
--
-- Fix: recreate the view with security_invoker=false so it always executes
-- with the VIEW OWNER's privileges (postgres), who can read price_reports.
-- security_barrier=true is kept to prevent predicate push-down leaking rows.

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

-- Re-grant select (drop+recreate loses grants)
grant select on public.public_price_observations to anon, authenticated;
