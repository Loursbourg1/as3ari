import { Big } from '../domain/money';
import type { DietTag, Ingredient, MealSlot, Recipe } from '../domain/types';
import type { IngredientPrice } from './prices';
import {
  aggregateIngredients,
  buildShoppingLines,
  pantryToBase,
  summarizeCosts,
  type CostSummary,
  type PantryItem,
  type ShoppingLine,
} from './shoppingList';

/**
 * Deterministic weekly planner. No AI, no randomness: the same inputs and prices
 * always produce the same plan.
 *
 * Priorities (in order):
 *  1. Respect exclusions (hard filter).
 *  2. Scale quantities to household size.
 *  3./4. Prefer pantry ingredients and ingredients already in the list.
 *  5./6. Minimise estimated cost and the number of distinct ingredients.
 *  7. Prefer ingredients with credible prices (unknown prices get a scoring penalty;
 *     that penalty is never added to displayed totals).
 *  8. Keep variety: each recipe at most twice a week, never twice in a row.
 * Then: a variety pass (swap repeats for unused recipes while within budget) and a
 * budget pass (swap expensive meals for cheaper ones while over budget).
 */

export const SLOTS: MealSlot[] = ['lunch', 'dinner'];
export const DAYS = 7;

/** Scoring constants (DZD-equivalent per serving-scale unit). Documented in docs/PLANNER.md. */
export const SCORING = {
  unknownPricePenalty: 150,
  newIngredientPenalty: 15,
  pantryBonus: 20,
  preferredBonus: 30,
  repeatPenalty: 120,
  maxUsesPerRecipe: 2,
} as const;

export interface PlannerInput {
  householdSize: number;
  /** Weekly food budget in DZD (decimal string) or null if not provided. */
  budget: string | null;
  pantry: PantryItem[];
  excludedTags: DietTag[];
  excludedIngredients: string[];
  preferredIngredients: string[];
}

export interface PlannedMeal {
  day: number; // 1..7
  slot: MealSlot;
  recipeId: string;
}

export type Suggestion =
  | { kind: 'increase_budget'; amount: string }
  | { kind: 'use_pantry'; ingredientIds: string[] }
  | { kind: 'missing_prices'; ingredientIds: string[] }
  | { kind: 'relax_exclusions' };

export interface MealPlanResult {
  ok: boolean;
  reason?: 'no_recipes' | 'invalid_input';
  meals: PlannedMeal[];
  scale: string;
  lines: ShoppingLine[];
  summary: CostSummary;
  eligibleRecipeIds: string[];
  suggestions: Suggestion[];
}

export function recipeTags(recipe: Recipe, ingredients: Map<string, Ingredient>): Set<DietTag> {
  const tags = new Set<DietTag>();
  for (const ri of recipe.ingredients) ingredients.get(ri.ingredient_id)?.diet_tags.forEach((t) => tags.add(t));
  return tags;
}

export function eligibleRecipes(recipes: Recipe[], ingredients: Ingredient[], input: Pick<PlannerInput, 'excludedTags' | 'excludedIngredients'>): Recipe[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return recipes.filter((r) => {
    if (r.ingredients.some((ri) => input.excludedIngredients.includes(ri.ingredient_id))) return false;
    const tags = recipeTags(r, byId);
    return !input.excludedTags.some((t) => tags.has(t));
  });
}

interface Ctx {
  recipes: Map<string, Recipe>;
  ingredients: Ingredient[];
  prices: Map<string, IngredientPrice>;
  pantry: Map<string, Big>;
  scale: Big;
  budget: string | null;
}

function evaluate(meals: PlannedMeal[], ctx: Ctx): { lines: ShoppingLine[]; summary: CostSummary } {
  const required = aggregateIngredients(meals.map((m) => ({ recipe: ctx.recipes.get(m.recipeId)!, scale: ctx.scale })));
  const lines = buildShoppingLines(required, ctx.pantry, ctx.ingredients, ctx.prices);
  return { lines, summary: summarizeCosts(lines, ctx.budget) };
}

/** Cost used for scoring only: known costs plus a penalty per unknown-price ingredient. */
function scoringCost(meals: PlannedMeal[], ctx: Ctx): Big {
  const { lines } = evaluate(meals, ctx);
  let total = new Big(0);
  for (const l of lines) {
    if (l.isStaple || new Big(l.remainingBase).eq(0)) continue;
    total = total.plus(l.cost ?? new Big(SCORING.unknownPricePenalty).times(ctx.scale));
  }
  return total;
}

export function generateMealPlan(
  input: PlannerInput,
  catalog: { recipes: Recipe[]; ingredients: Ingredient[] },
  prices: Map<string, IngredientPrice>,
): MealPlanResult {
  const household = Math.trunc(input.householdSize);
  const emptySummary = summarizeCosts([], input.budget);
  if (!(household >= 1 && household <= 20)) {
    return { ok: false, reason: 'invalid_input', meals: [], scale: '0', lines: [], summary: emptySummary, eligibleRecipeIds: [], suggestions: [] };
  }

  const eligible = eligibleRecipes(catalog.recipes, catalog.ingredients, input).sort((a, b) => a.id.localeCompare(b.id));
  const slotOk = SLOTS.every((s) => eligible.some((r) => r.meal_slots.includes(s)));
  if (eligible.length === 0 || !slotOk) {
    return {
      ok: false,
      reason: 'no_recipes',
      meals: [],
      scale: '0',
      lines: [],
      summary: emptySummary,
      eligibleRecipeIds: eligible.map((r) => r.id),
      suggestions: [{ kind: 'relax_exclusions' }],
    };
  }

  const servings = eligible[0]!.servings;
  const ctx: Ctx = {
    recipes: new Map(eligible.map((r) => [r.id, r])),
    ingredients: catalog.ingredients,
    prices,
    pantry: pantryToBase(input.pantry),
    scale: new Big(household).div(servings),
    budget: input.budget,
  };
  const staple = new Set(catalog.ingredients.filter((i) => i.is_staple).map((i) => i.id));
  const maxUses = Math.max(SCORING.maxUsesPerRecipe, Math.ceil((DAYS * SLOTS.length) / eligible.length));

  // ---- Greedy construction -------------------------------------------------
  const meals: PlannedMeal[] = [];
  const uses = new Map<string, number>();
  for (let day = 1; day <= DAYS; day++) {
    for (const slot of SLOTS) {
      const prev = meals[meals.length - 1]?.recipeId;
      const inList = new Set(meals.flatMap((m) => ctx.recipes.get(m.recipeId)!.ingredients.map((i) => i.ingredient_id)));
      const baseCost = scoringCost(meals, ctx);
      let candidates = eligible.filter((r) => r.meal_slots.includes(slot) && (uses.get(r.id) ?? 0) < maxUses && r.id !== prev);
      if (candidates.length === 0) candidates = eligible.filter((r) => r.meal_slots.includes(slot));

      let best: { recipe: Recipe; score: Big } | null = null;
      for (const r of candidates) {
        const marginal = scoringCost([...meals, { day, slot, recipeId: r.id }], ctx).minus(baseCost);
        let score = marginal;
        for (const ri of r.ingredients) {
          if (staple.has(ri.ingredient_id)) continue;
          if (!inList.has(ri.ingredient_id)) score = score.plus(SCORING.newIngredientPenalty);
          if (ctx.pantry.has(ri.ingredient_id)) score = score.minus(SCORING.pantryBonus);
          if (input.preferredIngredients.includes(ri.ingredient_id)) score = score.minus(SCORING.preferredBonus);
        }
        score = score.plus(new Big(SCORING.repeatPenalty).times(uses.get(r.id) ?? 0));
        if (!best || score.lt(best.score)) best = { recipe: r, score };
      }
      meals.push({ day, slot, recipeId: best!.recipe.id });
      uses.set(best!.recipe.id, (uses.get(best!.recipe.id) ?? 0) + 1);
    }
  }

  const total = (ms: PlannedMeal[]) => new Big(evaluate(ms, ctx).summary.estimatedTotal);
  const withinBudget = (ms: PlannedMeal[]) => input.budget === null || total(ms).lte(input.budget);
  const noBackToBack = (ms: PlannedMeal[]) => ms.every((m, i) => i === 0 || ms[i - 1]!.recipeId !== m.recipeId);

  // ---- Variety pass: replace repeats with unused recipes while staying within budget.
  if (withinBudget(meals)) {
    for (let i = meals.length - 1; i >= 0; i--) {
      const m = meals[i]!;
      const count = meals.filter((x) => x.recipeId === m.recipeId).length;
      if (count < 2) continue;
      const used = new Set(meals.map((x) => x.recipeId));
      let best: { id: string; cost: Big } | null = null;
      for (const r of eligible) {
        if (used.has(r.id) || !r.meal_slots.includes(m.slot)) continue;
        const trial = meals.map((x, j) => (j === i ? { ...x, recipeId: r.id } : x));
        if (!noBackToBack(trial) || !withinBudget(trial)) continue;
        const c = scoringCost(trial, ctx);
        if (!best || c.lt(best.cost)) best = { id: r.id, cost: c };
      }
      if (best) meals[i] = { ...m, recipeId: best.id };
    }
  }

  // ---- Budget pass: while over budget, apply the single swap that saves the most.
  if (input.budget !== null) {
    for (let guard = 0; guard < 40 && !withinBudget(meals); guard++) {
      const current = total(meals);
      let best: { i: number; id: string; cost: Big } | null = null;
      meals.forEach((m, i) => {
        for (const r of eligible) {
          if (r.id === m.recipeId || !r.meal_slots.includes(m.slot)) continue;
          const trial = meals.map((x, j) => (j === i ? { ...x, recipeId: r.id } : x));
          if (!noBackToBack(trial) || trial.filter((x) => x.recipeId === r.id).length > maxUses + 1) continue;
          const c = total(trial);
          if (c.lt(current) && (!best || c.lt(best.cost))) best = { i, id: r.id, cost: c };
        }
      });
      if (!best) break;
      const b = best as { i: number; id: string; cost: Big };
      meals[b.i] = { ...meals[b.i]!, recipeId: b.id };
    }
  }

  const { lines, summary } = evaluate(meals, ctx);
  const suggestions: Suggestion[] = [];
  if (summary.status === 'over' && summary.difference) {
    suggestions.push({ kind: 'increase_budget', amount: new Big(summary.difference).abs().toFixed(2) });
    const drivers = lines
      .filter((l) => l.cost !== null && !l.isStaple)
      .sort((a, b) => new Big(b.cost!).cmp(a.cost!))
      .slice(0, 3)
      .map((l) => l.ingredientId);
    if (drivers.length) suggestions.push({ kind: 'use_pantry', ingredientIds: drivers });
    if (input.excludedTags.length || input.excludedIngredients.length) suggestions.push({ kind: 'relax_exclusions' });
  }
  if (summary.missing.length) suggestions.push({ kind: 'missing_prices', ingredientIds: summary.missing });

  return {
    ok: true,
    meals,
    scale: ctx.scale.toFixed(4),
    lines,
    summary,
    eligibleRecipeIds: eligible.map((r) => r.id),
    suggestions,
  };
}
