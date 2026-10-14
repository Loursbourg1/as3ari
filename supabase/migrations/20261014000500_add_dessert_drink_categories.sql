-- Keep the live Supabase catalogue in sync with the bundled reference catalogue.
insert into public.categories (id, name_en, name_fr, name_ar, recent_days, stale_days, sort_order)
values
  ('desserts', 'Desserts', 'Desserts', 'حلويات', 14, 45, 8),
  ('drinks', 'Drinks', 'Boissons', 'مشروبات', 7, 21, 9)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  recent_days = excluded.recent_days,
  stale_days = excluded.stale_days,
  sort_order = excluded.sort_order;

insert into public.products (
  id, category_id, name_en, name_fr, name_ar, variant_en, variant_fr, variant_ar,
  dimension, search_terms, min_unit_price, max_unit_price
)
values
  ('baklava', 'desserts', 'Baklava', 'Baklava', 'بقلاوة', null, null, null,
    'count', array['baklava', 'baklawa', 'boulawa']::text[], 50, 1000),
  ('orange-juice', 'drinks', 'Orange juice', 'Jus d’orange', 'عصير برتقال',
    'fresh', 'frais', 'طازج', 'volume', array['juice', 'jus', 'asir', 'عصير']::text[], 80, 1200),
  ('water', 'drinks', 'Water', 'Eau', 'ماء', 'mineral', 'minérale', 'معدني',
    'volume', array['water', 'eau', 'ma', 'ماء']::text[], 20, 400)
on conflict (id) do update set
  category_id = excluded.category_id,
  name_en = excluded.name_en,
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  variant_en = excluded.variant_en,
  variant_fr = excluded.variant_fr,
  variant_ar = excluded.variant_ar,
  dimension = excluded.dimension,
  search_terms = excluded.search_terms,
  min_unit_price = excluded.min_unit_price,
  max_unit_price = excluded.max_unit_price,
  is_active = true;

insert into public.ingredients (id, name_en, name_fr, name_ar, dimension, diet_tags, is_staple, pricing_product_id)
values
  ('baklava', 'Baklava', 'Baklava', 'بقلاوة', 'count', array['gluten']::text[], false, 'baklava'),
  ('orange-juice', 'Orange juice', 'Jus d’orange', 'عصير برتقال', 'volume', '{}'::text[], false, 'orange-juice'),
  ('water', 'Water', 'Eau', 'ماء', 'volume', '{}'::text[], false, 'water')
on conflict (id) do update set
  name_en = excluded.name_en,
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  dimension = excluded.dimension,
  diet_tags = excluded.diet_tags,
  is_staple = excluded.is_staple,
  pricing_product_id = excluded.pricing_product_id;
