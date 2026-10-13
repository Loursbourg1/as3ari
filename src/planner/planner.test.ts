import { describe, expect, it } from 'vitest';
import { Big } from '../domain/money';
import { addDays } from '../domain/dates';
import type { PriceObservation } from '../domain/types';
import { CATEGORIES, INGREDIENTS, PRODUCTS } from '../data/reference/catalog';
import { RECIPES } from '../data/reference/recipes';
import { estimateIngredientPrices } from './prices';
import { aggregateIngredients, buildShoppingLines, lineCost, pantryToBase, summarizeCosts } from './shoppingList';
import { eligibleRecipes, generateMealPlan, type PlannerInput } from './planner';

const TODAY = '2026-10-11';
const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

/** One fresh observation per pricing product at a uniform 100 DZD per comparison unit. */
function uniformObservations(daysAgo = 1, price = '100.00', skip: string[] = []): PriceObservation[] {
  return PRODUCTS.filter((p) => !skip.includes(p.id)).map((p, i) => ({
    id: `o${i}`, product_id: p.id, shop_id: 's1', price, quantity: '1',
    unit: p.dimension === 'mass' ? 'kg' : p.dimension === 'volume' ? 'l' : 'piece',
    normalized_price: price, comparison_unit: p.dimension === 'mass' ? 'kg' : p.dimension === 'volume' ? 'l' : 'piece',
    observed_on: addDays(TODAY, -daysAgo), submitted_at: `${TODAY}T00:00:00Z`, source: 'community', is_demo: false, corroborating_reports: 0,
  }));
}
const prices = (obs: PriceObservation[]) =>
  estimateIngredientPrices({ ingredients: INGREDIENTS, products: PRODUCTS, categories: CATEGORIES, observations: obs, today: TODAY });

const base: PlannerInput = { householdSize: 4, budget: '20000', pantry: [], excludedTags: [], excludedIngredients: [], preferredIngredients: [] };

describe('recipe catalogue integrity', () => {
  it('every recipe ingredient exists and uses a unit of the right dimension', () => {
    const ing = new Map(INGREDIENTS.map((i) => [i.id, i]));
    for (const r of RECIPES) {
      expect(r.ingredients.length).toBeGreaterThan(2);
      for (const ri of r.ingredients) {
        const i = ing.get(ri.ingredient_id);
        expect(i, `${r.id}:${ri.ingredient_id}`).toBeDefined();
        const dim = { g: 'mass', kg: 'mass', ml: 'volume', l: 'volume', piece: 'count' }[ri.unit];
        expect(dim).toBe(i!.dimension);
      }
      expect(r.steps.en?.length).toBeGreaterThan(0);
    }
  });
  it('every non-staple ingredient maps to a product of the same dimension', () => {
    for (const i of INGREDIENTS.filter((x) => !x.is_staple)) {
      expect(PRODUCTS.find((p) => p.id === i.pricing_product_id)?.dimension).toBe(i.dimension);
    }
  });
});

describe('scaling, aggregation and pantry subtraction', () => {
  it('scales recipe quantities to the household size', () => {
    const totals = aggregateIngredients([{ recipe: recipe('lentil-stew'), scale: new Big(6).div(4) }]);
    expect(totals.get('lentils')!.toFixed(0)).toBe('600');
    expect(totals.get('bread')!.toFixed(1)).toBe('1.5');
  });
  it('aggregates the same ingredient across recipes', () => {
    const totals = aggregateIngredients([{ recipe: recipe('lentil-stew'), scale: 1 }, { recipe: recipe('lentil-soup'), scale: 1 }]);
    expect(totals.get('lentils')!.toFixed(0)).toBe('700');
  });
  it('subtracts pantry quantities and never goes below zero; rounds purchases up', () => {
    const required = aggregateIngredients([{ recipe: recipe('lentil-stew'), scale: new Big(6).div(4) }]);
    const pantry = pantryToBase([{ ingredientId: 'lentils', quantity: '0.25', unit: 'kg' }, { ingredientId: 'onion', quantity: '5', unit: 'kg' }]);
    const lines = buildShoppingLines(required, pantry, INGREDIENTS, prices(uniformObservations()));
    expect(lines.find((l) => l.ingredientId === 'lentils')!.remainingBase).toBe('350');
    expect(lines.find((l) => l.ingredientId === 'onion')!.remainingBase).toBe('0');
    expect(lines.find((l) => l.ingredientId === 'onion')!.cost).toBe('0.00');
    expect(lines.find((l) => l.ingredientId === 'bread')!.remainingBase).toBe('2'); // 1.5 loaves -> buy 2
  });
  it('computes line costs from price per comparison unit', () => {
    const p = prices(uniformObservations()).get('lentils');
    expect(lineCost('350', 'mass', p)).toBe('35.00'); // 0.35 kg * 100
    expect(lineCost('350', 'mass', undefined)).toBeNull();
  });
});

describe('missing and stale prices', () => {
  it('missing prices are unknown, never zero', () => {
    const p = prices(uniformObservations(1, '100.00', ['lentils']));
    expect(p.get('lentils')!.basis).toBe('missing');
    const lines = buildShoppingLines(aggregateIngredients([{ recipe: recipe('lentil-stew'), scale: 1 }]), new Map(), INGREDIENTS, p);
    expect(lines.find((l) => l.ingredientId === 'lentils')!.cost).toBeNull();
    const s = summarizeCosts(lines, '100000');
    expect(s.missing).toContain('lentils');
    expect(s.status).toBe('uncertain');
  });
  it('stale-only prices are flagged and kept separate', () => {
    const p = prices(uniformObservations(400));
    expect(p.get('potato')!.basis).toBe('stale');
    const lines = buildShoppingLines(aggregateIngredients([{ recipe: recipe('lentil-stew'), scale: 1 }]), new Map(), INGREDIENTS, p);
    const s = summarizeCosts(lines, '100000');
    expect(s.recentCost).toBe('0.00');
    expect(new Big(s.staleCost).gt(0)).toBe(true);
    expect(s.stalePriced).toContain('potato');
    expect(s.status).toBe('uncertain');
  });
  it('staples are never costed', () => {
    const p = prices(uniformObservations());
    expect(p.get('salt-spices')!.basis).toBe('staple');
  });
});

describe('generateMealPlan', () => {
  const p = prices(uniformObservations());

  it('produces 14 meals over 7 days and is deterministic', () => {
    const a = generateMealPlan(base, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    const b = generateMealPlan(base, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(a.ok).toBe(true);
    expect(a.meals).toHaveLength(14);
    expect(new Set(a.meals.map((m) => m.day))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    expect(a.meals).toEqual(b.meals);
  });

  it('respects slot suitability, variety limits and no back-to-back repeats', () => {
    const r = generateMealPlan(base, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    for (const [i, m] of r.meals.entries()) {
      expect(recipe(m.recipeId).meal_slots).toContain(m.slot);
      if (i > 0) expect(r.meals[i - 1]!.recipeId).not.toBe(m.recipeId);
    }
    const counts = new Map<string, number>();
    r.meals.forEach((m) => counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1));
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it('respects dietary exclusions', () => {
    const r = generateMealPlan({ ...base, excludedTags: ['red_meat', 'poultry', 'fish'] }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    const banned = new Set(['chicken', 'lamb', 'beef-minced', 'sardines']);
    for (const m of r.meals) expect(recipe(m.recipeId).ingredients.some((i) => banned.has(i.ingredient_id))).toBe(false);
    expect(r.lines.some((l) => banned.has(l.ingredientId))).toBe(false);
  });

  it('respects excluded ingredients', () => {
    const r = generateMealPlan({ ...base, excludedIngredients: ['egg'] }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(r.lines.some((l) => l.ingredientId === 'egg')).toBe(false);
  });

  it('fails honestly when exclusions leave no recipes', () => {
    const r = generateMealPlan({ ...base, excludedTags: ['gluten', 'legume', 'egg', 'red_meat', 'poultry', 'fish', 'dairy'] }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_recipes');
  });

  it('rejects invalid household sizes', () => {
    expect(generateMealPlan({ ...base, householdSize: 0 }, { recipes: RECIPES, ingredients: INGREDIENTS }, p).reason).toBe('invalid_input');
  });

  it('scales the total cost with household size', () => {
    const two = generateMealPlan({ ...base, householdSize: 2, budget: null }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    const eight = generateMealPlan({ ...base, householdSize: 8, budget: null }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(new Big(eight.summary.estimatedTotal).gt(two.summary.estimatedTotal)).toBe(true);
    expect(two.summary.status).toBe('no_budget');
  });

  it('uses pantry items to reduce the shopping list', () => {
    const without = generateMealPlan(base, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    const withPantry = generateMealPlan({ ...base, pantry: [{ ingredientId: 'potato', quantity: '10', unit: 'kg' }] }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(new Big(withPantry.summary.estimatedTotal).lt(without.summary.estimatedTotal)).toBe(true);
  });

  it('reports infeasible budgets with suggestions instead of hiding the gap', () => {
    const r = generateMealPlan({ ...base, budget: '500' }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(r.ok).toBe(true);
    expect(r.summary.status).toBe('over');
    expect(new Big(r.summary.difference!).lt(0)).toBe(true);
    expect(r.suggestions[0]!.kind).toBe('increase_budget');
  });

  it('a tighter budget never yields a more expensive plan', () => {
    const loose = generateMealPlan({ ...base, budget: '100000' }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    const tight = generateMealPlan({ ...base, budget: '1000' }, { recipes: RECIPES, ingredients: INGREDIENTS }, p);
    expect(new Big(tight.summary.estimatedTotal).lte(loose.summary.estimatedTotal)).toBe(true);
  });

  it('flags missing prices instead of costing them at zero', () => {
    const r = generateMealPlan(base, { recipes: RECIPES, ingredients: INGREDIENTS }, prices([]));
    expect(r.ok).toBe(true);
    expect(r.summary.estimatedTotal).toBe('0.00');
    expect(r.summary.missing.length).toBeGreaterThan(0);
    expect(r.summary.status).toBe('uncertain');
    expect(r.suggestions.some((s) => s.kind === 'missing_prices')).toBe(true);
  });

  it('eligibleRecipes filters by tags', () => {
    expect(eligibleRecipes(RECIPES, INGREDIENTS, { excludedTags: ['egg'], excludedIngredients: [] }).some((r) => r.id === 'chakchouka')).toBe(false);
  });
});
