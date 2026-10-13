/**
 * Core domain types. A Product is a canonical grocery item, a Shop is a physical
 * location, and a PriceObservation is a dated report of a product's price at a shop.
 * Decimal values (money, quantities) are carried as strings to avoid binary float drift.
 */
export type UnitCode = 'g' | 'kg' | 'ml' | 'l' | 'piece';
export type Dimension = 'mass' | 'volume' | 'count';
export type ComparisonUnit = 'kg' | 'l' | 'piece';
export type ReportStatus = 'pending' | 'approved' | 'rejected';
export type ReportSource = 'community' | 'demo' | 'import' | 'business';
export type FreshnessState = 'recent' | 'aging' | 'stale';
export type ShopKind = 'shop' | 'market' | 'supermarket' | 'butcher' | 'bakery' | 'greengrocer' | 'grocery';
export type LocationProvenance = 'verified_visit' | 'official_source' | 'openstreetmap' | 'demo';
export type DietTag = 'red_meat' | 'poultry' | 'fish' | 'egg' | 'dairy' | 'gluten' | 'legume';
export type MealSlot = 'lunch' | 'dinner';
export type Locale = 'en' | 'fr' | 'ar';

export interface LocalizedName {
  name_en: string;
  name_fr: string;
  name_ar: string;
}

export interface Wilaya extends LocalizedName {
  code: number;
  center_lat: number | null;
  center_lng: number | null;
  default_zoom: number | null;
  is_pilot: boolean;
}

export interface LocalArea extends LocalizedName {
  id: string;
  wilaya_code: number;
  kind: 'commune' | 'neighbourhood';
}

export interface Category extends LocalizedName {
  id: string;
  /** Observations up to this age (days) are "recent". */
  recent_days: number;
  /** Observations older than this (days) are "stale" and never shown as current. */
  stale_days: number;
  sort_order: number;
}

export interface Product extends LocalizedName {
  id: string;
  category_id: string;
  variant_en: string | null;
  variant_fr: string | null;
  variant_ar: string | null;
  dimension: Dimension;
  search_terms: string[];
  /** Plausibility bounds (DZD per comparison unit) used to reject absurd reports. */
  min_unit_price: string;
  max_unit_price: string;
  is_custom?: boolean;
}

export interface Ingredient extends LocalizedName {
  id: string;
  dimension: Dimension;
  diet_tags: DietTag[];
  /** Staples (salt, spices, water) are assumed available and never costed. */
  is_staple: boolean;
  pricing_product_id: string | null;
}

export interface RecipeIngredient {
  ingredient_id: string;
  quantity: string;
  unit: UnitCode;
}

export interface Recipe extends LocalizedName {
  id: string;
  servings: number;
  meal_slots: MealSlot[];
  steps: Partial<Record<Locale, string[]>>;
  ingredients: RecipeIngredient[];
}

export interface Shop {
  id: string;
  name: string;
  kind: ShopKind;
  wilaya_code: number;
  area_id: string | null;
  address_text: string | null;
  lat: number;
  lng: number;
  provenance: LocationProvenance;
  is_demo: boolean;
}

/** A public, approved observation as exposed by the public view. */
export interface PriceObservation {
  id: string;
  product_id: string;
  shop_id: string;
  price: string;
  quantity: string;
  unit: UnitCode;
  normalized_price: string | null;
  comparison_unit: ComparisonUnit;
  observed_on: string; // YYYY-MM-DD
  submitted_at: string; // ISO timestamp
  source: ReportSource;
  is_demo: boolean;
  /** Number of distinct other contributors whose approved reports agree. */
  corroborating_reports: number;
  photo_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  location_label?: string | null;
  wilaya_code?: number | null;
  area_id?: string | null;
  likes?: number;
  dislikes?: number;
  is_anonymous?: boolean;
  reporter_name?: string | null;
}

export interface Catalog {
  categories: Category[];
  products: Product[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  wilayas: Wilaya[];
  areas: LocalArea[];
}

export interface Page<T> {
  items: T[];
  total: number | null;
  offset: number;
  limit: number;
}
