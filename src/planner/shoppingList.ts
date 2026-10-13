import { Big, roundMoney, sumMoney } from '../domain/money';
import { baseToComparison, toBaseQuantity } from '../domain/units';
import type { Dimension, Ingredient, Recipe, UnitCode } from '../domain/types';
import type { IngredientPrice } from './prices';

export interface PantryItem {
  ingredientId: string;
  quantity: string;
  unit: UnitCode;
}

export interface RecipeUse {
  recipe: Recipe;
  /** Multiplier applied to the recipe quantities (household size / servings). */
  scale: Big.BigSource;
}

/** Sum scaled recipe quantities per ingredient, in base units (g / ml / piece). */
export function aggregateIngredients(uses: RecipeUse[]): Map<string, Big> {
  const totals = new Map<string, Big>();
  for (const { recipe, scale } of uses) {
    for (const ri of recipe.ingredients) {
      const q = toBaseQuantity(ri.quantity, ri.unit).times(scale);
      totals.set(ri.ingredient_id, (totals.get(ri.ingredient_id) ?? new Big(0)).plus(q));
    }
  }
  return totals;
}

export function pantryToBase(pantry: PantryItem[]): Map<string, Big> {
  const out = new Map<string, Big>();
  for (const p of pantry) {
    const q = toBaseQuantity(p.quantity, p.unit);
    out.set(p.ingredientId, (out.get(p.ingredientId) ?? new Big(0)).plus(q));
  }
  return out;
}

/** Round a base quantity up to something you can actually buy (whole grams/ml/pieces). */
export function roundUpForPurchase(base: Big): Big {
  return base.round(0, Big.roundUp);
}

/** Cost of a base quantity at a price per comparison unit. Returns null when the price is unknown. */
export function lineCost(remainingBase: Big.BigSource, dimension: Dimension, price: IngredientPrice | undefined): string | null {
  if (!price || price.unitPrice === null) return null;
  return roundMoney(baseToComparison(remainingBase, dimension).times(price.unitPrice));
}

export interface ShoppingLine {
  ingredientId: string;
  dimension: Dimension;
  requiredBase: string;
  pantryBase: string;
  remainingBase: string;
  price: IngredientPrice | undefined;
  /** null = cost unknown (missing price) or not costed (staple). Never coerced to 0. */
  cost: string | null;
  isStaple: boolean;
}

export function buildShoppingLines(
  required: Map<string, Big>,
  pantry: Map<string, Big>,
  ingredients: Ingredient[],
  prices: Map<string, IngredientPrice>,
): ShoppingLine[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const lines: ShoppingLine[] = [];
  for (const [ingredientId, req] of required) {
    const ing = byId.get(ingredientId);
    if (!ing) continue;
    const have = pantry.get(ingredientId) ?? new Big(0);
    const remaining = roundUpForPurchase(req.minus(have).gt(0) ? req.minus(have) : new Big(0));
    const price = prices.get(ingredientId);
    lines.push({
      ingredientId,
      dimension: ing.dimension,
      requiredBase: req.round(2).toFixed(2),
      pantryBase: have.round(2).toFixed(2),
      remainingBase: remaining.toFixed(0),
      price,
      cost: ing.is_staple ? null : remaining.eq(0) ? '0.00' : lineCost(remaining, ing.dimension, price),
      isStaple: ing.is_staple,
    });
  }
  return lines.sort((a, b) => Number(a.isStaple) - Number(b.isStaple) || a.ingredientId.localeCompare(b.ingredientId));
}

export type BudgetStatus = 'within' | 'uncertain' | 'over' | 'no_budget';

export interface CostSummary {
  /** Cost of lines priced from recent observations. */
  recentCost: string;
  /** Cost of lines priced only from stale observations (uncertain). */
  staleCost: string;
  /** recentCost + staleCost. A lower bound when `missing` is not empty. */
  estimatedTotal: string;
  /** Ingredients still to buy whose price is unknown. */
  missing: string[];
  /** Ingredients priced only from stale observations. */
  stalePriced: string[];
  budget: string | null;
  /** budget - estimatedTotal (negative = over budget). */
  difference: string | null;
  status: BudgetStatus;
  usesDemoPrices: boolean;
}

export function summarizeCosts(lines: ShoppingLine[], budget: string | null): CostSummary {
  const toBuy = lines.filter((l) => !l.isStaple && new Big(l.remainingBase).gt(0));
  const recent = toBuy.filter((l) => l.price?.basis === 'recent' && l.cost !== null);
  const stale = toBuy.filter((l) => l.price?.basis === 'stale' && l.cost !== null);
  const missing = toBuy.filter((l) => l.cost === null).map((l) => l.ingredientId);
  const recentCost = sumMoney(recent.map((l) => l.cost!));
  const staleCost = sumMoney(stale.map((l) => l.cost!));
  const estimatedTotal = sumMoney([recentCost, staleCost]);
  let difference: string | null = null;
  let status: BudgetStatus = 'no_budget';
  if (budget !== null) {
    difference = roundMoney(new Big(budget).minus(estimatedTotal));
    if (new Big(difference).lt(0)) status = 'over';
    else status = missing.length > 0 || stale.length > 0 ? 'uncertain' : 'within';
  }
  return {
    recentCost,
    staleCost,
    estimatedTotal,
    missing,
    stalePriced: stale.map((l) => l.ingredientId),
    budget,
    difference,
    status,
    usesDemoPrices: toBuy.some((l) => l.price?.isDemo),
  };
}
