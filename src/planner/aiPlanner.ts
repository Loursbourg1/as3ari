import { z } from 'zod';
import { Big } from '../domain/money';
import type { Catalog } from '../domain/types';
import type { IngredientPrice } from './prices';
import { config } from '../config/env';
import {
  generateMealPlan,
  type MealPlanResult,
  type PlannedMeal,
  type PlannerInput,
  SLOTS,
} from './planner';
import {
  aggregateIngredients,
  buildShoppingLines,
  pantryToBase,
  summarizeCosts,
  type PantryItem,
} from './shoppingList';
import { calculatePlanNutrition, type WeeklyNutritionSummary } from '../domain/nutrition';
import { readJson, writeJson } from '../platform/platform';

/**
 * Strict Zod schema for validating raw Gemini AI responses.
 * We NEVER trust any claimed costs or totals from the AI; we parse only the meal slots
 * and recalculate everything deterministically.
 */
export const aiGeneratedPlanSchema = z.object({
  explanation: z.string().optional(),
  meals: z.array(
    z.object({
      day: z.number().int().min(1).max(7),
      slot: z.enum(['lunch', 'dinner']),
      recipeId: z.string().min(1),
    }),
  ),
});

export type AiGeneratedPlan = z.infer<typeof aiGeneratedPlanSchema>;

export interface AiMealPlanResult extends MealPlanResult {
  isAiGenerated: boolean;
  aiExplanation?: string;
  aiError?: string;
  nutrition: WeeklyNutritionSummary;
  budgetRemaining: string | null;
  budgetUsedPercent: number | null;
}

export interface AiPlannerRequest extends PlannerInput {
  foodPreferences?: string;
  wilayaCode: number;
  catalog: Catalog;
  prices: Map<string, IngredientPrice>;
  apiKey?: string;
}

const CACHE_KEY_PREFIX = 'as3ari.ai_plan_cache.';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedPlan {
  timestamp: number;
  explanation: string;
  meals: PlannedMeal[];
}

function computeCacheKey(req: AiPlannerRequest): string {
  const parts = [
    req.householdSize,
    req.budget ?? 'nobudget',
    req.wilayaCode,
    req.excludedTags.sort().join(','),
    req.excludedIngredients.sort().join(','),
    req.preferredIngredients.sort().join(','),
    req.foodPreferences?.trim() || '',
    req.pantry.map((p) => `${p.ingredientId}:${p.quantity}${p.unit}`).sort().join(','),
  ];
  return CACHE_KEY_PREFIX + btoa(parts.join('|')).replace(/[/+=]/g, '_');
}

/**
 * Recalculate costs, nutrition, and shopping list for an arbitrary meal assignment.
 * Guarantees that even if an AI or user swaps meals, all numbers are 100% verified.
 */
export function recalculatePlan(
  meals: PlannedMeal[],
  householdSize: number,
  budget: string | null,
  pantryItems: PantryItem[],
  catalog: Catalog,
  prices: Map<string, IngredientPrice>,
  aiExplanation?: string,
  isAiGenerated = false,
): AiMealPlanResult {
  const scale = new Big(householdSize).div(4);
  const byId = new Map(catalog.recipes.map((r) => [r.id, r]));

  // 1. Gather all recipe ingredients scaled by household size
  const uses = meals.map((m) => {
    const r = byId.get(m.recipeId);
    if (!r) throw new Error(`Unknown recipe: ${m.recipeId}`);
    return { recipe: r, scale };
  });
  const aggregate = aggregateIngredients(uses);

  // 2. Convert pantry stocks into base units
  const pantryBase = pantryToBase(pantryItems);

  // 3. Build line-by-line shopping requirements
  const lines = buildShoppingLines(aggregate, pantryBase, catalog.ingredients, prices);

  // 4. Summarize genuine As3ari costs
  const summary = summarizeCosts(lines, budget);

  // 5. Calculate nutrition per serving and total household intake
  const nutrition = calculatePlanNutrition(meals, householdSize);

  // 6. Calculate remaining budget
  let budgetRemaining: string | null = null;
  let budgetUsedPercent: number | null = null;
  if (budget !== null) {
    const b = new Big(budget);
    const est = new Big(summary.estimatedTotal);
    budgetRemaining = b.minus(est).toFixed(2);
    budgetUsedPercent = b.gt(0) ? Math.min(999, Math.round(est.div(b).times(100).toNumber())) : 100;
  }

  return {
    ok: true,
    isAiGenerated,
    aiExplanation,
    meals,
    scale: scale.toFixed(4),
    lines,
    summary,
    eligibleRecipeIds: catalog.recipes.map((r) => r.id),
    suggestions: [],
    nutrition,
    budgetRemaining,
    budgetUsedPercent,
  };
}

/**
 * Calls Google Gemini API to generate a culturally contextual, budget-conscious
 * Algerian weekly meal plan, then recalculates and validates every single number.
 */
export async function generateSmartMealPlan(req: AiPlannerRequest): Promise<AiMealPlanResult> {
  const { householdSize, budget, pantry, excludedTags, excludedIngredients, preferredIngredients, foodPreferences, catalog, prices } = req;

  // Filter recipes according to dietary hard constraints first
  const ingMap = new Map(catalog.ingredients.map((i) => [i.id, i]));
  const eligible = catalog.recipes.filter((r) => {
    if (r.ingredients.some((ri) => excludedIngredients.includes(ri.ingredient_id))) return false;
    for (const ri of r.ingredients) {
      const ing = ingMap.get(ri.ingredient_id);
      if (ing?.diet_tags.some((t) => excludedTags.includes(t))) return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    const deterministic = generateMealPlan(
      { householdSize, budget, pantry, excludedTags, excludedIngredients, preferredIngredients },
      catalog,
      prices,
    );
    return {
      ...deterministic,
      isAiGenerated: false,
      nutrition: calculatePlanNutrition(deterministic.meals, householdSize),
      budgetRemaining: null,
      budgetUsedPercent: null,
    };
  }

  // Check client-side session cache
  const cacheKey = computeCacheKey(req);
  const cached = readJson<CachedPlan | null>(cacheKey, null);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return recalculatePlan(cached.meals, householdSize, budget, pantry, catalog, prices, cached.explanation, true);
  }

  // If Supabase is not configured (pure offline demo mode), run the deterministic planner.
  // In production the proxy edge function supplies the API key from Supabase secrets.
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    const deterministic = generateMealPlan(
      { householdSize, budget, pantry, excludedTags, excludedIngredients, preferredIngredients },
      catalog,
      prices,
    );
    const nutrition = calculatePlanNutrition(deterministic.meals, householdSize);
    let budgetRemaining: string | null = null;
    let budgetUsedPercent: number | null = null;
    if (budget !== null) {
      const b = new Big(budget);
      const est = new Big(deterministic.summary.estimatedTotal);
      budgetRemaining = b.minus(est).toFixed(2);
      budgetUsedPercent = b.gt(0) ? Math.min(999, Math.round(est.div(b).times(100).toNumber())) : 100;
    }
    return {
      ...deterministic,
      isAiGenerated: false,
      nutrition,
      budgetRemaining,
      budgetUsedPercent,
    };
  }

  // Build compact recipe manifest for the AI prompt
  const recipeManifest = eligible.map((r) => {
    const mainIngredients = r.ingredients.map((ri) => ri.ingredient_id).join(', ');
    return `ID: "${r.id}" | Name: "${r.name_fr}" (${r.name_ar}) | Slots: [${r.meal_slots.join(', ')}] | Ingredients: [${mainIngredients}]`;
  }).join('\n');

  const pantryList = pantry.length > 0 ? pantry.map((p) => `${p.ingredientId} (${p.quantity} ${p.unit})`).join(', ') : 'None';
  const exclusionsList = excludedTags.length > 0 ? excludedTags.join(', ') : 'None';
  const preferencesList = preferredIngredients.length > 0 ? preferredIngredients.join(', ') : 'None';

  const systemPrompt = `You are a specialized Algerian culinary and budget optimizer for the As3ari grocery platform.
Your task is to plan a balanced 7-day weekly meal plan (Day 1 to 7, each day having 'lunch' and 'dinner') for an Algerian family.

RULES:
1. ONLY pick recipe IDs from the AVAILABLE RECIPES list below. NEVER invent new IDs.
2. Respect household size: ${householdSize} people.
3. Weekly food budget target: ${budget ? `${budget} DZD` : 'Optimize for high affordability'}.
4. Prioritize recipes using available pantry items: ${pantryList}.
5. STRICTLY obey dietary exclusions: ${exclusionsList}.
6. Favor preferred ingredients: ${preferencesList}.
${foodPreferences ? `7. User note: "${foodPreferences}".` : ''}
8. Ensure variety: avoid eating the exact same recipe twice in a row, and keep repeats under 2 times per week.
9. Return ONLY a valid JSON object matching this schema. Do not include markdown codeblocks or extra text.

JSON SCHEMA:
{
  "explanation": "A friendly 1-2 sentence summary in French or Arabic explaining how this plan respects the budget and preferences.",
  "meals": [
    { "day": 1, "slot": "lunch", "recipeId": "<id>" },
    { "day": 1, "slot": "dinner", "recipeId": "<id>" },
    ... exactly 14 meals (days 1-7, slots 'lunch' and 'dinner')
  ]
}

AVAILABLE RECIPES:
${recipeManifest}`;

  try {
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    // Call the Gemini proxy edge function — the API key is a server-side Supabase
    // secret and is never exposed to the browser. Model fallback is handled server-side.
    const proxyUrl = `${config.supabaseUrl}/functions/v1/gemini-proxy`;
    let res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass the anon key so the edge function can validate the request origin
        'apikey': config.supabaseAnonKey,
      },
      body: payload,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        errorDetail = errJson.error?.message || errorDetail;
      } catch {
        errorDetail = errText || errorDetail;
      }
      throw new Error(`Gemini API: ${errorDetail}`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error('Empty response from AI');

    // Clean JSON if needed
    const cleanedJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsedRaw = JSON.parse(cleanedJson);

    // Validate with strict schema
    const validation = aiGeneratedPlanSchema.safeParse(parsedRaw);
    if (!validation.success) {
      throw new Error('AI output failed schema validation');
    }

    const { explanation, meals: rawMeals } = validation.data;

    // Sanitize and ensure full 14 slots (days 1..7 x ['lunch', 'dinner'])
    const validMealSet = new Set(eligible.map((r) => r.id));
    const fallbackRecipe = eligible[0]!.id;
    const finalMeals: PlannedMeal[] = [];

    for (let day = 1; day <= 7; day++) {
      for (const slot of SLOTS) {
        const found = rawMeals.find((m) => m.day === day && m.slot === slot);
        const recipeId = found && validMealSet.has(found.recipeId) ? found.recipeId : fallbackRecipe;
        finalMeals.push({ day, slot, recipeId });
      }
    }

    // Save into cache
    writeJson(cacheKey, {
      timestamp: Date.now(),
      explanation: explanation || 'Plan optimisé par Gemini AI selon vos prix locaux et vos ingrédients.',
      meals: finalMeals,
    });

    // Recalculate 100% of the numbers with genuine As3ari pricing engine
    return recalculatePlan(
      finalMeals,
      householdSize,
      budget,
      pantry,
      catalog,
      prices,
      explanation || 'Plan optimisé par Gemini AI selon vos prix locaux et vos ingrédients.',
      true,
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Deterministic fallback planner if Gemini fails or quota exhausted
    const fallback = generateMealPlan(
      { householdSize, budget, pantry, excludedTags, excludedIngredients, preferredIngredients },
      catalog,
      prices,
    );
    const nutrition = calculatePlanNutrition(fallback.meals, householdSize);
    let budgetRemaining: string | null = null;
    let budgetUsedPercent: number | null = null;
    if (budget !== null) {
      const b = new Big(budget);
      const est = new Big(fallback.summary.estimatedTotal);
      budgetRemaining = b.minus(est).toFixed(2);
      budgetUsedPercent = b.gt(0) ? Math.min(999, Math.round(est.div(b).times(100).toNumber())) : 100;
    }
    return {
      ...fallback,
      isAiGenerated: false,
      aiExplanation: 'Mode de secours déterministe (quota ou indisponibilité IA). Calculé au plus bas coût.',
      aiError: errorMsg,
      nutrition,
      budgetRemaining,
      budgetUsedPercent,
    };
  }
}
