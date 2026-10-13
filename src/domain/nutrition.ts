export interface NutritionValues {
  calories: number; // kcal per serving
  protein: number; // g per serving
  carbs: number; // g per serving
  fat: number; // g per serving
  fiber: number; // g per serving
}

export interface DayNutrition {
  day: number;
  perServing: NutritionValues;
  householdTotal: NutritionValues;
}

export interface WeeklyNutritionSummary {
  dailyAveragePerServing: NutritionValues;
  weeklyTotalPerServing: NutritionValues;
  weeklyTotalHousehold: NutritionValues;
  byDay: DayNutrition[];
}

/**
 * Benchmark nutrition values per 1 adult serving for As3ari's structured recipes.
 * Standard nutritional estimates based on traditional Algerian preparations.
 */
export const RECIPE_NUTRITION: Record<string, NutritionValues> = {
  'lentil-stew': { calories: 415, protein: 24, carbs: 64, fat: 7, fiber: 16 },
  'chickpea-stew': { calories: 435, protein: 19, carbs: 68, fat: 9, fiber: 14 },
  'white-bean-stew': { calories: 395, protein: 22, carbs: 65, fat: 6, fiber: 18 },
  'chorba-frik-chicken': { calories: 420, protein: 34, carbs: 46, fat: 12, fiber: 8 },
  'couscous-chicken': { calories: 690, protein: 42, carbs: 94, fat: 16, fiber: 11 },
  'couscous-vegetables': { calories: 510, protein: 16, carbs: 96, fat: 8, fiber: 13 },
  'rechta-chicken': { calories: 640, protein: 38, carbs: 88, fat: 15, fiber: 7 },
  'chakchouka': { calories: 295, protein: 15, carbs: 22, fat: 17, fiber: 6 },
  'loubia-green-beans': { calories: 320, protein: 18, carbs: 36, fat: 12, fiber: 9 },
  'tajine-zitoun': { calories: 540, protein: 37, carbs: 26, fat: 29, fiber: 5 },
  'batata-fliou': { calories: 290, protein: 12, carbs: 40, fat: 10, fiber: 6 },
  'mfaouar-rice': { calories: 470, protein: 22, carbs: 74, fat: 10, fiber: 6 },
  'spaghetti-tuna': { calories: 530, protein: 32, carbs: 76, fat: 12, fiber: 5 },
  'chorba-vermicelli': { calories: 370, protein: 27, carbs: 44, fat: 9, fiber: 5 },
  'berkoukes-vegetables': { calories: 485, protein: 19, carbs: 86, fat: 8, fiber: 12 },
  'sardine-casserole': { calories: 440, protein: 35, carbs: 25, fat: 23, fiber: 5 },
};

const DEFAULT_NUTRITION: NutritionValues = {
  calories: 450,
  protein: 25,
  carbs: 60,
  fat: 12,
  fiber: 8,
};

export function getRecipeNutrition(recipeId: string): NutritionValues {
  return RECIPE_NUTRITION[recipeId] ?? DEFAULT_NUTRITION;
}

/**
 * Computes exact daily and weekly nutrition totals across all planned meals,
 * scaled to the household size.
 */
export function calculatePlanNutrition(
  meals: Array<{ day: number; slot: string; recipeId: string }>,
  householdSize: number,
): WeeklyNutritionSummary {
  const scale = Math.max(1, householdSize);
  const byDay: DayNutrition[] = [];

  for (let d = 1; d <= 7; d++) {
    const dayMeals = meals.filter((m) => m.day === d);
    let dayCalories = 0;
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFat = 0;
    let dayFiber = 0;

    for (const m of dayMeals) {
      const n = getRecipeNutrition(m.recipeId);
      dayCalories += n.calories;
      dayProtein += n.protein;
      dayCarbs += n.carbs;
      dayFat += n.fat;
      dayFiber += n.fiber;
    }

    const perServing: NutritionValues = {
      calories: Math.round(dayCalories),
      protein: Math.round(dayProtein),
      carbs: Math.round(dayCarbs),
      fat: Math.round(dayFat),
      fiber: Math.round(dayFiber),
    };

    const householdTotal: NutritionValues = {
      calories: Math.round(dayCalories * scale),
      protein: Math.round(dayProtein * scale),
      carbs: Math.round(dayCarbs * scale),
      fat: Math.round(dayFat * scale),
      fiber: Math.round(dayFiber * scale),
    };

    byDay.push({ day: d, perServing, householdTotal });
  }

  const totalCalories = byDay.reduce((acc, d) => acc + d.perServing.calories, 0);
  const totalProtein = byDay.reduce((acc, d) => acc + d.perServing.protein, 0);
  const totalCarbs = byDay.reduce((acc, d) => acc + d.perServing.carbs, 0);
  const totalFat = byDay.reduce((acc, d) => acc + d.perServing.fat, 0);
  const totalFiber = byDay.reduce((acc, d) => acc + d.perServing.fiber, 0);

  const daysCount = byDay.length || 7;

  return {
    dailyAveragePerServing: {
      calories: Math.round(totalCalories / daysCount),
      protein: Math.round(totalProtein / daysCount),
      carbs: Math.round(totalCarbs / daysCount),
      fat: Math.round(totalFat / daysCount),
      fiber: Math.round(totalFiber / daysCount),
    },
    weeklyTotalPerServing: {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
      fiber: Math.round(totalFiber),
    },
    weeklyTotalHousehold: {
      calories: Math.round(totalCalories * scale),
      protein: Math.round(totalProtein * scale),
      carbs: Math.round(totalCarbs * scale),
      fat: Math.round(totalFat * scale),
      fiber: Math.round(totalFiber * scale),
    },
    byDay,
  };
}
