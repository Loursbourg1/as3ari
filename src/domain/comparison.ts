import { Big } from './money';
import { freshnessOf, thresholdsFor, type Freshness } from './freshness';
import { distanceKm, type LatLng } from './geo';
import { COMPARISON_UNIT } from './units';
import type { Category, ComparisonUnit, PriceObservation, Product, Shop } from './types';

export type SortKey = 'price' | 'freshness' | 'distance';

/**
 * none:          no observations at all
 * stale_only:    observations exist but all are stale
 * insufficient:  only one shop has a current observation (no comparison possible)
 * limited:       2–4 shops with current observations
 * adequate:      5+ shops with current observations (still not a claim of full coverage)
 */
export type CoverageLevel = 'none' | 'stale_only' | 'insufficient' | 'limited' | 'adequate';

export interface ComparisonRow {
  shop: Shop;
  observation: PriceObservation;
  freshness: Freshness;
  distanceKm: number | null;
  /** True only when at least two shops have current observations and this is the minimum. */
  isLowestReported: boolean;
  /** Number of comparable approved observations stored for this shop (history). */
  historyCount: number;
}

export interface Comparison {
  product: Product;
  comparisonUnit: ComparisonUnit;
  rows: ComparisonRow[];
  currentShopCount: number;
  staleShopCount: number;
  coverage: CoverageLevel;
}

function newerFirst(a: PriceObservation, b: PriceObservation): number {
  if (a.observed_on !== b.observed_on) return a.observed_on < b.observed_on ? 1 : -1;
  return a.submitted_at < b.submitted_at ? 1 : a.submitted_at > b.submitted_at ? -1 : 0;
}

/** Observations of this product that can be compared with each other. */
export function comparableObservations(product: Product, observations: PriceObservation[]): PriceObservation[] {
  const unit = COMPARISON_UNIT[product.dimension];
  return observations.filter(
    (o) => o.product_id === product.id && o.comparison_unit === unit && o.normalized_price !== null,
  );
}

export function latestPerShop(observations: PriceObservation[]): Map<string, { latest: PriceObservation; count: number }> {
  const out = new Map<string, { latest: PriceObservation; count: number }>();
  for (const o of [...observations].sort(newerFirst)) {
    const cur = out.get(o.shop_id);
    if (cur) cur.count += 1;
    else out.set(o.shop_id, { latest: o, count: 1 });
  }
  return out;
}

export function coverageLevel(currentShops: number, staleShops: number): CoverageLevel {
  if (currentShops === 0) return staleShops > 0 ? 'stale_only' : 'none';
  if (currentShops === 1) return 'insufficient';
  if (currentShops < 5) return 'limited';
  return 'adequate';
}

export interface BuildComparisonInput {
  product: Product;
  observations: PriceObservation[];
  shops: Shop[];
  categories: Category[];
  today: string;
  sort?: SortKey;
  origin?: LatLng | null;
}

export function buildComparison(input: BuildComparisonInput): Comparison {
  const { product, shops, categories, today, origin = null } = input;
  const sort = input.sort === 'distance' && !origin ? 'price' : (input.sort ?? 'price');
  const thresholds = thresholdsFor(product.category_id, categories);
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const perShop = latestPerShop(comparableObservations(product, input.observations));

  const rows: ComparisonRow[] = [];
  for (const [shopId, { latest, count }] of perShop) {
    const shop = shopById.get(shopId);
    if (!shop) continue;
    rows.push({
      shop,
      observation: latest,
      freshness: freshnessOf(latest.observed_on, today, thresholds),
      distanceKm: origin ? distanceKm(origin, shop) : null,
      isLowestReported: false,
      historyCount: count,
    });
  }

  const current = rows.filter((r) => r.freshness.state !== 'stale');
  if (current.length >= 2) {
    const min = current.reduce((m, r) => {
      const v = new Big(r.observation.normalized_price!);
      return m === null || v.lt(m) ? v : m;
    }, null as Big | null)!;
    for (const r of current) r.isLowestReported = new Big(r.observation.normalized_price!).eq(min);
  }

  const price = (r: ComparisonRow) => new Big(r.observation.normalized_price!);
  const staleRank = (r: ComparisonRow) => (r.freshness.state === 'stale' ? 1 : 0);
  rows.sort((a, b) => {
    if (sort === 'freshness') return newerFirst(a.observation, b.observation) || price(a).cmp(price(b));
    // Stale rows always sink below current ones for price and distance sorting.
    const s = staleRank(a) - staleRank(b);
    if (s !== 0) return s;
    if (sort === 'distance') return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || price(a).cmp(price(b));
    return price(a).cmp(price(b)) || newerFirst(a.observation, b.observation);
  });

  return {
    product,
    comparisonUnit: COMPARISON_UNIT[product.dimension],
    rows,
    currentShopCount: current.length,
    staleShopCount: rows.length - current.length,
    coverage: coverageLevel(current.length, rows.length - current.length),
  };
}

/** Median of decimal strings (returns null for an empty list). */
export function medianPrice(values: string[]): string | null {
  if (values.length === 0) return null;
  const sorted = values.map((v) => new Big(v)).sort((a, b) => a.cmp(b));
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid]! : sorted[mid - 1]!.plus(sorted[mid]!).div(2);
  return m.round(2).toFixed(2);
}
