/**
 * Device-local persistence for the planner and checklist. Household budgets and
 * pantry details never leave the device unless the user explicitly saves them.
 */
import type { DietTag, MealSlot } from '../domain/types';
import { readJson, writeJson } from '../platform/platform';
import type { PantryItem, ShoppingLine, CostSummary } from './shoppingList';

export interface PlannerForm {
  householdSize: number;
  budget: string;
  pantry: PantryItem[];
  excludedTags: DietTag[];
  preferredIngredients: string[];
}

export interface StoredPlan {
  version: 1;
  createdAt: string;
  wilayaCode: number;
  householdSize: number;
  meals: { day: number; slot: MealSlot; recipeId: string }[];
  lines: ShoppingLine[];
  summary: CostSummary;
}

export interface ListEdits {
  [ingredientId: string]: { quantityBase?: string; acquired?: boolean };
}

const FORM_KEY = 'as3ari.planner.form';
const PLAN_KEY = 'as3ari.planner.plan';
const EDITS_KEY = 'as3ari.list.edits';

export const DEFAULT_FORM: PlannerForm = { householdSize: 4, budget: '', pantry: [], excludedTags: [], preferredIngredients: [] };

export const loadForm = (): PlannerForm => ({ ...DEFAULT_FORM, ...readJson<Partial<PlannerForm>>(FORM_KEY, {}) });
export const saveForm = (f: PlannerForm) => writeJson(FORM_KEY, f);

export function loadPlan(): StoredPlan | null {
  const p = readJson<StoredPlan | null>(PLAN_KEY, null);
  return p && p.version === 1 && Array.isArray(p.lines) ? p : null;
}
export function savePlan(p: StoredPlan) {
  writeJson(PLAN_KEY, p);
  writeJson(EDITS_KEY, {});
}

export const loadEdits = (): ListEdits => readJson<ListEdits>(EDITS_KEY, {});
export const saveEdits = (e: ListEdits) => writeJson(EDITS_KEY, e);
