-- Row Level Security and privileges.
-- Supabase grants broad table privileges to anon/authenticated by default, so we
-- revoke everything first and grant back only what each role needs. RLS is enabled
-- on every table; policies are the second line of defence behind grants.

-- ---------------------------------------------------------------------------
-- Reset privileges
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.wilayas enable row level security;
alter table public.local_areas enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.price_reports enable row level security;
alter table public.report_flags enable row level security;
alter table public.moderation_events enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.saved_lists enable row level security;
alter table public.saved_list_items enable row level security;

-- ---------------------------------------------------------------------------
-- Public reference data: everyone can read; only admins can change.
-- ---------------------------------------------------------------------------
grant select on public.wilayas, public.local_areas, public.categories, public.products, public.ingredients,
  public.recipes, public.recipe_ingredients, public.shops to anon, authenticated;
grant insert, update, delete on public.wilayas, public.local_areas, public.categories, public.products,
  public.ingredients, public.recipes, public.recipe_ingredients, public.shops to authenticated;

create policy "public read" on public.wilayas for select to anon, authenticated using (true);
create policy "public read" on public.local_areas for select to anon, authenticated using (true);
create policy "public read" on public.categories for select to anon, authenticated using (true);
create policy "public read" on public.products for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read" on public.ingredients for select to anon, authenticated using (true);
create policy "public read" on public.recipes for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read" on public.recipe_ingredients for select to anon, authenticated using (true);
create policy "public read" on public.shops for select to anon, authenticated using (is_active or public.is_admin());

create policy "admin write" on public.wilayas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.local_areas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.ingredients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.recipes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.recipe_ingredients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.shops for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles: private to their owner. Only display_name is editable.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Roles: users may see their own roles; nobody can grant roles through the API.
-- Admins are assigned with SQL by the project owner (see docs/SECURITY.md).
-- ---------------------------------------------------------------------------
grant select on public.user_roles to authenticated;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Price reports: no direct table access for anon/authenticated.
-- Reads go through public_price_observations (approved only) and my_price_reports();
-- writes go through submit_price_report() / moderate_price_report().
-- The policy below only matters if a future grant is added by mistake.
-- ---------------------------------------------------------------------------
create policy "moderators read" on public.price_reports for select to authenticated using (public.is_moderator());

grant select on public.public_price_observations to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Flags: users can see the flags they raised; creation goes through flag_price_report().
-- ---------------------------------------------------------------------------
grant select on public.report_flags to authenticated;
create policy "own flags read" on public.report_flags for select to authenticated
  using (flagged_by = auth.uid() or public.is_moderator());

-- Moderation audit trail: moderators only, read-only.
grant select on public.moderation_events to authenticated;
create policy "moderators read" on public.moderation_events for select to authenticated using (public.is_moderator());

-- ---------------------------------------------------------------------------
-- Private household data: owner only.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.meal_plans, public.meal_plan_items, public.saved_lists,
  public.saved_list_items to authenticated;

create policy "owner all" on public.meal_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner all" on public.saved_lists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner all" on public.meal_plan_items for all to authenticated
  using (exists (select 1 from public.meal_plans m where m.id = meal_plan_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.meal_plans m where m.id = meal_plan_id and m.user_id = auth.uid()));
create policy "owner all" on public.saved_list_items for all to authenticated
  using (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.saved_lists l where l.id = list_id and l.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Function execution
-- ---------------------------------------------------------------------------
grant execute on function public.search_products(text, integer) to anon, authenticated;
grant execute on function public.area_coverage(smallint) to anon, authenticated;
grant execute on function public.normalize_price(numeric, numeric, public.unit_code) to anon, authenticated;
grant execute on function public.unit_dimension_of(public.unit_code) to anon, authenticated;
grant execute on function public.today_algeria() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
grant execute on function public.submit_price_report(text, uuid, numeric, numeric, public.unit_code, date) to authenticated;
grant execute on function public.my_price_reports(integer, integer) to authenticated;
grant execute on function public.flag_price_report(uuid, public.flag_reason, text) to authenticated;
grant execute on function public.moderation_queue(public.report_status, boolean, integer, integer) to authenticated;
grant execute on function public.moderate_price_report(uuid, text, text) to authenticated;

-- Functions created later must not become callable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
