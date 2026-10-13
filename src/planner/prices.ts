import { comparableObservations, latestPerShop, medianPrice } from '../domain/comparison';
import { freshnessOf, thresholdsFor } from '../domain/freshness';
import { COMPARISON_UNIT } from '../domain/units';
import type { Category, ComparisonUnit, Ingredient, PriceObservation, Product } from '../domain/types';

/**
 * recent:  median of shops whose latest observation is not stale
 * stale:   only stale observations exist — usable as a rough hint, flagged as uncertain
 * missing: no observation at all — cost is UNKNOWN (never treated as zero)
 * staple:  salt/spices/water — assumed available, not costed
 */
export type PriceBasis = 'recent' | 'stale' | 'missing' | 'staple';

export interface IngredientPrice {
  ingredientId: string;
  productId: string | null;
  basis: PriceBasis;
  /** DZD per comparison unit (kg / l / piece). */
  unitPrice: string | null;
  comparisonUnit: ComparisonUnit;
  shopCount: number;
  observedFrom: string | null;
  observedTo: string | null;
  isDemo: boolean;
}

export interface EstimatePricesInput {
  ingredients: Ingredient[];
  products: Product[];
  categories: Category[];
  observations: PriceObservation[];
  today: string;
}

export function estimateIngredientPrices(input: EstimatePricesInput): Map<string, IngredientPrice> {
  const { ingredients, products, categories, observations, today } = input;
  const out = new Map<string, IngredientPrice>();
  for (const ing of ingredients) {
    const base: IngredientPrice = {
      ingredientId: ing.id,
      productId: ing.pricing_product_id,
      basis: ing.is_staple ? 'staple' : 'missing',
      unitPrice: null,
      comparisonUnit: COMPARISON_UNIT[ing.dimension],
      shopCount: 0,
      observedFrom: null,
      observedTo: null,
      isDemo: false,
    };
    const product = products.find((p) => p.id === ing.pricing_product_id);
    if (ing.is_staple || !product || product.dimension !== ing.dimension) {
      out.set(ing.id, base);
      continue;
    }
    const t = thresholdsFor(product.category_id, categories);
    const latest = [...latestPerShop(comparableObservations(product, observations)).values()].map((x) => x.latest);
    const current = latest.filter((o) => freshnessOf(o.observed_on, today, t).state !== 'stale');
    const used = current.length > 0 ? current : latest;
    if (used.length === 0) {
      out.set(ing.id, base);
      continue;
    }
    const dates = used.map((o) => o.observed_on).sort();
    out.set(ing.id, {
      ...base,
      basis: current.length > 0 ? 'recent' : 'stale',
      unitPrice: medianPrice(used.map((o) => o.normalized_price!)),
      shopCount: used.length,
      observedFrom: dates[0]!,
      observedTo: dates[dates.length - 1]!,
      isDemo: used.some((o) => o.is_demo),
    });
  }
  return out;
}
