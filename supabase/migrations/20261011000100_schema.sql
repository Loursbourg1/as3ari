-- As3ari schema: products (canonical items), shops (physical locations) and
-- price_reports (dated observations) are stored separately. History is never overwritten.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.unit_code as enum ('g', 'kg', 'ml', 'l', 'piece');
create type public.unit_dimension as enum ('mass', 'volume', 'count');
create type public.report_status as enum ('pending', 'approved', 'rejected');
-- 'business' is reserved for a future verified-business feature (not used in this release).
create type public.report_source as enum ('community', 'demo', 'import', 'business');
create type public.shop_kind as enum ('shop', 'market', 'supermarket', 'butcher', 'bakery', 'greengrocer', 'grocery');
create type public.location_provenance as enum ('verified_visit', 'official_source', 'openstreetmap', 'demo');
create type public.app_role as enum ('admin', 'moderator');
create type public.meal_slot as enum ('lunch', 'dinner');
create type public.flag_reason as enum ('wrong_price', 'wrong_shop', 'wrong_product', 'duplicate', 'spam', 'other');

-- ---------------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------------
create table public.wilayas (
  code smallint primary key check (code between 1 and 99),
  name_en text not null check (char_length(name_en) between 1 and 80),
  name_fr text not null check (char_length(name_fr) between 1 and 80),
  name_ar text not null check (char_length(name_ar) between 1 and 80),
  center_lat numeric(9, 6) check (center_lat between 18 and 38),
  center_lng numeric(9, 6) check (center_lng between -9 and 12.5),
  default_zoom smallint check (default_zoom between 4 and 18),
  is_pilot boolean not null default false,
  check ((center_lat is null) = (center_lng is null))
);

create table public.local_areas (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  wilaya_code smallint not null references public.wilayas (code),
  kind text not null check (kind in ('commune', 'neighbourhood')),
  name_en text not null check (char_length(name_en) between 1 and 80),
  name_fr text not null check (char_length(name_fr) between 1 and 80),
  name_ar text not null check (char_length(name_ar) between 1 and 80)
);
create index local_areas_wilaya_idx on public.local_areas (wilaya_code);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name_en text not null,
  name_fr text not null,
  name_ar text not null,
  recent_days integer not null check (recent_days > 0),
  stale_days integer not null,
  sort_order integer not null default 0,
  check (stale_days > recent_days)
);

create table public.products (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  category_id text not null references public.categories (id),
  name_en text not null check (char_length(name_en) between 1 and 120),
  name_fr text not null check (char_length(name_fr) between 1 and 120),
  name_ar text not null check (char_length(name_ar) between 1 and 120),
  variant_en text check (char_length(variant_en) <= 80),
  variant_fr text check (char_length(variant_fr) <= 80),
  variant_ar text check (char_length(variant_ar) <= 80),
  dimension public.unit_dimension not null,
  search_terms text[] not null default '{}',
  min_unit_price numeric(12, 2) not null check (min_unit_price > 0),
  max_unit_price numeric(12, 2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_unit_price > min_unit_price)
);
create index products_category_idx on public.products (category_id);

create table public.ingredients (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name_en text not null,
  name_fr text not null,
  name_ar text not null,
  dimension public.unit_dimension not null,
  diet_tags text[] not null default '{}'
    check (diet_tags <@ array['red_meat', 'poultry', 'fish', 'egg', 'dairy', 'gluten', 'legume']::text[]),
  is_staple boolean not null default false,
  pricing_product_id text references public.products (id),
  check (is_staple or pricing_product_id is not null)
);

create table public.recipes (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  name_en text not null,
  name_fr text not null,
  name_ar text not null,
  servings smallint not null check (servings between 1 and 20),
  meal_slots public.meal_slot[] not null check (cardinality(meal_slots) > 0),
  steps jsonb not null default '{}'::jsonb check (jsonb_typeof(steps) = 'object'),
  is_active boolean not null default true
);

create table public.recipe_ingredients (
  recipe_id text not null references public.recipes (id) on delete cascade,
  ingredient_id text not null references public.ingredients (id),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 100000),
  unit public.unit_code not null,
  primary key (recipe_id, ingredient_id)
);

-- ---------------------------------------------------------------------------
-- Physical locations
-- ---------------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  kind public.shop_kind not null,
  wilaya_code smallint not null references public.wilayas (code),
  area_id text references public.local_areas (id),
  address_text text check (char_length(address_text) <= 200),
  -- Coordinates of the shop itself (never a contributor's location). Bounded to Algeria.
  lat numeric(9, 6) not null check (lat between 18 and 38),
  lng numeric(9, 6) not null check (lng between -9 and 12.5),
  provenance public.location_provenance not null,
  provenance_note text check (char_length(provenance_note) <= 300),
  is_demo boolean generated always as (provenance = 'demo') stored,
  is_active boolean not null default true,
  -- Reserved for future verified business profiles. Not used in this release.
  business_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, lat, lng)
);
create index shops_wilaya_idx on public.shops (wilaya_code) where is_active;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Observations
-- ---------------------------------------------------------------------------
create table public.price_reports (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  shop_id uuid not null references public.shops (id),
  contributor_id uuid references auth.users (id) on delete set null,
  price numeric(12, 2) not null check (price > 0 and price <= 1000000),
  quantity numeric(10, 3) not null check (quantity > 0 and quantity <= 100000),
  unit public.unit_code not null,
  comparison_unit public.unit_code not null check (comparison_unit in ('kg', 'l', 'piece')),
  normalized_price numeric(12, 2) check (normalized_price > 0),
  observed_on date not null check (observed_on >= date '2020-01-01'),
  submitted_at timestamptz not null default now(),
  status public.report_status not null default 'pending',
  source public.report_source not null default 'community',
  -- Evidence uploads are not implemented in this release (always null).
  evidence_path text check (evidence_path is null),
  provenance_note text check (char_length(provenance_note) <= 300),
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  rejection_reason text check (char_length(rejection_reason) <= 300),
  check (observed_on <= (submitted_at::date + 1))
);
-- One active report per contributor, product, shop and day (duplicate guard, race-safe).
create unique index price_reports_dedupe_idx
  on public.price_reports (contributor_id, product_id, shop_id, observed_on)
  where contributor_id is not null and status <> 'rejected';
create index price_reports_public_idx on public.price_reports (product_id, observed_on desc) where status = 'approved';
create index price_reports_shop_idx on public.price_reports (shop_id, observed_on desc) where status = 'approved';
create index price_reports_contributor_idx on public.price_reports (contributor_id, submitted_at desc);
create index price_reports_queue_idx on public.price_reports (status, submitted_at);

create table public.report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.price_reports (id) on delete cascade,
  flagged_by uuid not null references auth.users (id) on delete cascade,
  reason public.flag_reason not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (report_id, flagged_by)
);
create index report_flags_open_idx on public.report_flags (report_id) where resolved_at is null;

create table public.moderation_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.price_reports (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('approve', 'reject')),
  from_status public.report_status not null,
  to_status public.report_status not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index moderation_events_report_idx on public.moderation_events (report_id);

-- ---------------------------------------------------------------------------
-- Private household data (optional; anonymous users keep plans on their device)
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 80),
  household_size smallint not null check (household_size between 1 and 20),
  budget_dzd numeric(12, 2) check (budget_dzd >= 0 and budget_dzd <= 10000000),
  wilaya_code smallint references public.wilayas (code),
  created_at timestamptz not null default now()
);
create index meal_plans_user_idx on public.meal_plans (user_id);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  day smallint not null check (day between 1 and 7),
  slot public.meal_slot not null,
  recipe_id text not null references public.recipes (id),
  unique (meal_plan_id, day, slot)
);

create table public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  title text check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_lists_user_idx on public.saved_lists (user_id);

create table public.saved_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.saved_lists (id) on delete cascade,
  ingredient_id text not null references public.ingredients (id),
  quantity numeric(10, 3) not null check (quantity >= 0 and quantity <= 100000),
  unit public.unit_code not null,
  acquired boolean not null default false,
  unique (list_id, ingredient_id)
);
