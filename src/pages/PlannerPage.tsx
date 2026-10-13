import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { Big, formatDZD, parseMoney, parseQuantity } from '../domain/money';
import { addDays } from '../domain/dates';
import { BASE_UNIT, formatBaseQuantity, toBaseQuantity, unitsForDimension } from '../domain/units';
import type { Catalog, DietTag, MealSlot, UnitCode } from '../domain/types';
import { estimateIngredientPrices, type IngredientPrice } from '../planner/prices';
import { loadForm, saveForm, savePlan, type PlannerForm } from '../planner/storage';
import { generateSmartMealPlan, recalculatePlan, type AiMealPlanResult } from '../planner/aiPlanner';
import { config } from '../config/env';
import { useI18n } from '../i18n/I18nProvider';
import { Badge, Button, ErrorState, Field, Notice, PageContainer, Select, Spinner, TextInput, cx } from '../components/ui';

const TAGS: DietTag[] = ['red_meat', 'poultry', 'fish', 'egg', 'dairy', 'gluten', 'legume'];

export default function PlannerPage() {
  const { t, name, locale } = useI18n();
  const { catalog, repo, wilayaCode, wilaya, today } = useAppData();
  const [form, setForm] = useState<PlannerForm>(loadForm);
  const [foodPreferences, setFoodPreferences] = useState('');
  const [result, setResult] = useState<AiMealPlanResult | null>(null);
  const [cachedPrices, setCachedPrices] = useState<Map<string, IngredientPrice> | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const [replacingSlot, setReplacingSlot] = useState<{ day: number; slot: MealSlot } | null>(null);

  const cat = catalog.data;
  if (!cat) return catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />;

  const update = (patch: Partial<PlannerForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    saveForm(next);
  };

  async function generate() {
    setFormError(null);
    const size = Math.trunc(Number(form.householdSize));
    if (!(size >= 1 && size <= 20)) return setFormError(t('plan.invalid'));
    const budget = form.budget.trim() ? parseMoney(form.budget) : null;
    if (form.budget.trim() && budget === null) return setFormError(t('plan.invalidBudget'));
    setState('busy');
    try {
      const pricing = cat!.ingredients.filter((i) => i.pricing_product_id).map((i) => i.pricing_product_id!);
      const obs = await repo.listObservations({ wilayaCode, productIds: pricing, since: addDays(today, -365), limit: 2000, offset: 0 });
      const prices = estimateIngredientPrices({ ingredients: cat!.ingredients, products: cat!.products, categories: cat!.categories, observations: obs.items, today });
      setCachedPrices(prices);

      // Ignore pantry rows with an invalid or empty quantity rather than guessing.
      const pantry = form.pantry.flatMap((p) => {
        const q = parseQuantity(p.quantity);
        const ing = cat!.ingredients.find((i) => i.id === p.ingredientId);
        return q && ing && unitsForDimension(ing.dimension).includes(p.unit) ? [{ ...p, quantity: q }] : [];
      });

      const r = await generateSmartMealPlan({
        householdSize: size,
        budget,
        pantry,
        excludedTags: form.excludedTags,
        excludedIngredients: [],
        preferredIngredients: form.preferredIngredients,
        foodPreferences,
        wilayaCode,
        catalog: cat!,
        prices,
        apiKey: config.geminiApiKey,
      });

      setResult(r);
      if (r.ok) {
        savePlan({ version: 1, createdAt: new Date().toISOString(), wilayaCode, householdSize: size, meals: r.meals, lines: r.lines, summary: r.summary });
      }
      setState('idle');
    } catch {
      setState('error');
    }
  }

  function handleSwapMeal(day: number, slot: MealSlot, newRecipeId: string) {
    if (!result || !cachedPrices) return;
    const size = Math.trunc(Number(form.householdSize));
    const budget = form.budget.trim() ? parseMoney(form.budget) : null;
    const pantry = form.pantry.flatMap((p) => {
      const q = parseQuantity(p.quantity);
      const ing = cat!.ingredients.find((i) => i.id === p.ingredientId);
      return q && ing && unitsForDimension(ing.dimension).includes(p.unit) ? [{ ...p, quantity: q }] : [];
    });

    const updatedMeals = result.meals.map((m) =>
      m.day === day && m.slot === slot ? { ...m, recipeId: newRecipeId } : m,
    );

    const nextPlan = recalculatePlan(
      updatedMeals,
      size,
      budget,
      pantry,
      cat!,
      cachedPrices,
      result.aiExplanation,
      result.isAiGenerated,
    );

    setResult(nextPlan);
    setReplacingSlot(null);
  }

  const ingName = (id: string) => {
    const i = cat.ingredients.find((x) => x.id === id);
    return i ? name(i) : id;
  };
  const costable = cat.ingredients.filter((i) => !i.is_staple);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('plan.title')}</h1>
          <p className="mt-1 text-sm text-ink-2">{t('plan.intro')}</p>
        </div>
        {config.hasGeminiAi && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-50/80 px-3 py-1 text-xs font-bold text-brand-700">
            <Sparkles className="size-3.5 text-brand-600 animate-pulse" />
            Gemini AI Active
          </span>
        )}
      </div>

      <form
        className="mt-4 space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        aria-label={t('plan.title')}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('plan.household')} htmlFor="household">
            <div className="flex items-center gap-1">
              <Button aria-label="−" onClick={() => update({ householdSize: Math.max(1, form.householdSize - 1) })} className="w-10 px-0 rounded-xl">
                <Minus className="size-4" aria-hidden />
              </Button>
              <TextInput
                id="household"
                inputMode="numeric"
                value={String(form.householdSize)}
                onChange={(e) => update({ householdSize: Number(e.target.value.replace(/\D/g, '').slice(0, 2)) || 0 })}
                className="num w-14 text-center rounded-xl font-bold"
              />
              <Button aria-label="+" onClick={() => update({ householdSize: Math.min(20, form.householdSize + 1) })} className="w-10 px-0 rounded-xl">
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
          </Field>
          <Field label={t('plan.budget')} htmlFor="budget">
            <TextInput
              id="budget"
              inputMode="decimal"
              placeholder="12000"
              value={form.budget}
              onChange={(e) => update({ budget: e.target.value.slice(0, 12) })}
              className="num rounded-xl font-bold"
            />
          </Field>
        </div>
        <p className="text-xs text-muted">
          {t('plan.area')}: <strong className="text-ink-2">{wilaya ? name(wilaya) : ''}</strong>
        </p>

        {/* Dietary Notes & Food Preferences */}
        <div>
          <label htmlFor="foodPreferences" className="block text-[13px] font-semibold text-ink-2 mb-1">
            {t('plan.foodPreferences')} <span className="font-normal text-muted">({t('common.optional')})</span>
          </label>
          <TextInput
            id="foodPreferences"
            value={foodPreferences}
            onChange={(e) => setFoodPreferences(e.target.value.slice(0, 120))}
            placeholder={t('plan.foodPreferencesPlaceholder')}
            className="rounded-xl text-xs"
          />
        </div>

        {/* Pantry Items */}
        <fieldset>
          <legend className="text-[13px] font-semibold text-ink-2">{t('plan.pantry')}</legend>
          <p className="text-xs text-muted">{t('plan.pantryHint')}</p>
          <ul className="mt-2 space-y-2">
            {form.pantry.map((item, idx) => {
              const ing = cat.ingredients.find((i) => i.id === item.ingredientId);
              const units = ing ? unitsForDimension(ing.dimension) : (['kg'] as UnitCode[]);
              return (
                <li key={idx} className="flex items-center gap-2">
                  <Select
                    aria-label={t('plan.ingredient')}
                    value={item.ingredientId}
                    onChange={(e) => {
                      const ni = cat.ingredients.find((i) => i.id === e.target.value)!;
                      const pantry = [...form.pantry];
                      pantry[idx] = {
                        ingredientId: ni.id,
                        quantity: item.quantity,
                        unit: unitsForDimension(ni.dimension).includes(item.unit)
                          ? item.unit
                          : BASE_UNIT[ni.dimension] === 'g'
                            ? 'kg'
                            : BASE_UNIT[ni.dimension] === 'ml'
                              ? 'l'
                              : 'piece',
                      };
                      update({ pantry });
                    }}
                    className="min-w-0 flex-1 rounded-xl"
                  >
                    {costable.map((i) => (
                      <option key={i.id} value={i.id}>
                        {name(i)}
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    aria-label={t('list.quantity')}
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => {
                      const pantry = [...form.pantry];
                      pantry[idx] = { ...item, quantity: e.target.value.slice(0, 8) };
                      update({ pantry });
                    }}
                    className="num w-20 rounded-xl"
                  />
                  <Select
                    aria-label={t('contribute.unit')}
                    value={item.unit}
                    onChange={(e) => {
                      const pantry = [...form.pantry];
                      pantry[idx] = { ...item, unit: e.target.value as UnitCode };
                      update({ pantry });
                    }}
                    className="w-20 rounded-xl"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {t(`common.unit.${u}`)}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    aria-label={t('plan.remove')}
                    onClick={() => update({ pantry: form.pantry.filter((_, j) => j !== idx) })}
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-canvas"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <Button
            size="sm"
            className="mt-2 rounded-xl"
            onClick={() => update({ pantry: [...form.pantry, { ingredientId: 'potato', quantity: '1', unit: 'kg' }] })}
          >
            <Plus className="size-4" aria-hidden />
            {t('plan.addPantry')}
          </Button>
        </fieldset>

        {/* Dietary Exclusions */}
        <fieldset>
          <legend className="text-[13px] font-semibold text-ink-2">{t('plan.exclusions')}</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TAGS.map((tag) => {
              const on = form.excludedTags.includes(tag);
              return (
                <label
                  key={tag}
                  className={cx(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line-strong text-ink-2',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={on}
                    onChange={() => update({ excludedTags: on ? form.excludedTags.filter((x) => x !== tag) : [...form.excludedTags, tag] })}
                  />
                  {t(`plan.exclude.${tag}`)}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Ingredient Preferences */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-ink-2">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            {t('plan.preferences')} <span className="font-normal text-muted">({t('common.optional')})</span>
          </summary>
          <p className="mt-1 text-xs text-muted">{t('plan.preferencesHint')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {costable.map((i) => {
              const on = form.preferredIngredients.includes(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ preferredIngredients: on ? form.preferredIngredients.filter((x) => x !== i.id) : [...form.preferredIngredients, i.id] })}
                  className={cx(
                    'rounded-xl border px-2 py-1 text-xs font-medium transition-colors',
                    on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-2 hover:bg-canvas',
                  )}
                >
                  {name(i)}
                </button>
              );
            })}
          </div>
        </details>

        {formError && <p role="alert" className="text-sm font-medium text-danger">{formError}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={state === 'busy'} className="rounded-xl px-5 py-2.5 font-bold shadow-sm">
            {state === 'busy' ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> {t('plan.generating')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-4" /> {t('plan.generate')}
              </span>
            )}
          </Button>
          <span className="text-xs text-muted">{t('plan.privacy')}</span>
        </div>
      </form>

      {state === 'error' && <ErrorState onRetry={() => void generate()} />}

      {result && !result.ok && (
        <div className="mt-4">
          <Notice tone="warn" icon={<AlertTriangle className="size-4" aria-hidden />}>
            {result.reason === 'no_recipes' ? t('plan.noRecipes') : t('plan.invalid')}
          </Notice>
        </div>
      )}

      {result?.ok && (
        <PlanResult
          result={result}
          catalog={cat}
          openMeal={openMeal}
          setOpenMeal={setOpenMeal}
          replacingSlot={replacingSlot}
          setReplacingSlot={setReplacingSlot}
          onSwapMeal={handleSwapMeal}
          ingName={ingName}
          locale={locale}
        />
      )}

      <details className="mt-6 text-sm text-ink-2">
        <summary className="cursor-pointer font-semibold">{t('plan.howItWorks')}</summary>
        <p className="mt-2">{t('plan.howItWorksBody')}</p>
        <p className="mt-2 text-xs text-muted">{t('plan.notMedical')}</p>
      </details>
    </PageContainer>
  );
}

function PlanResult({
  result,
  catalog,
  openMeal,
  setOpenMeal,
  replacingSlot,
  setReplacingSlot,
  onSwapMeal,
  ingName,
  locale,
}: {
  result: AiMealPlanResult;
  catalog: Catalog;
  openMeal: string | null;
  setOpenMeal: (k: string | null) => void;
  replacingSlot: { day: number; slot: MealSlot } | null;
  setReplacingSlot: (slot: { day: number; slot: MealSlot } | null) => void;
  onSwapMeal: (day: number, slot: MealSlot, newRecipeId: string) => void;
  ingName: (id: string) => string;
  locale: 'en' | 'fr' | 'ar';
}) {
  const { t, name, qtyLabels } = useI18n();
  const s = result.summary;
  const days = useMemo(() => [1, 2, 3, 4, 5, 6, 7].map((d) => result.meals.filter((m) => m.day === d)), [result.meals]);
  const toBuy = result.lines.filter((l) => !l.isStaple && new Big(l.remainingBase).gt(0));
  const scale = new Big(result.scale);
  const household = scale.times(4).round(0).toFixed(0);

  const statusTone = s.status === 'within' ? 'good' : s.status === 'over' ? 'warn' : 'neutral';

  return (
    <section className="mt-6 space-y-4" aria-label={t('plan.result')} data-testid="plan-result">
      {/* AI Header & Explanation Banner */}
      {result.isAiGenerated && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-800">
            <Sparkles className="size-4 text-brand-600" />
            <span>{t('plan.smartAi')}</span>
          </div>
          {result.aiExplanation && (
            <p className="text-xs text-ink-2 leading-relaxed">{result.aiExplanation}</p>
          )}
        </div>
      )}

      {/* Main Financial & Cost Overview Card */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold text-muted">{t('plan.estimate')}</p>
            <p className="num mt-1 text-3xl sm:text-4xl font-black text-ink" data-testid="plan-total">
              {s.missing.length ? '≥ ' : ''}
              {formatDZD(s.estimatedTotal, locale)}
            </p>
          </div>
          {result.budgetRemaining !== null && (
            <div className="sm:text-end">
              <span className="text-xs font-semibold text-muted block">
                {new Big(result.budgetRemaining).gte(0) ? t('plan.budgetRemaining') : t('plan.overBudget')}
              </span>
              <span
                className={cx(
                  'num text-2xl font-black',
                  new Big(result.budgetRemaining).gte(0) ? 'text-good' : 'text-danger',
                )}
              >
                {new Big(result.budgetRemaining).gte(0) ? '+' : ''}
                {formatDZD(result.budgetRemaining, locale)}
              </span>
            </div>
          )}
        </div>

        {s.budget !== null && s.difference !== null && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm border-t border-line/60 pt-3">
            <div>
              <dt className="text-muted text-xs">{t('plan.budgetLabel')}</dt>
              <dd className="num font-semibold text-ink">{formatDZD(s.budget, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">{t('plan.difference')}</dt>
              <dd className={cx('num font-semibold', new Big(s.difference).lt(0) ? 'text-danger' : 'text-good')}>
                {new Big(s.difference).gt(0) ? '+' : ''}
                {formatDZD(s.difference, locale)}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-3 space-y-2">
          <Notice tone={statusTone} icon={s.status === 'within' ? <CheckCircle2 className="size-4" aria-hidden /> : <Info className="size-4" aria-hidden />}>
            <span data-testid="plan-status">{t(`plan.status.${s.status}`)}</span>
          </Notice>
          {s.missing.length > 0 && <Notice tone="warn">{t('plan.lowerBound', { amount: formatDZD(s.estimatedTotal, locale), n: s.missing.length })}</Notice>}
          {new Big(s.staleCost).gt(0) && <Notice tone="warn">{t('plan.staleNote', { amount: formatDZD(s.staleCost, locale) })}</Notice>}
          {s.usesDemoPrices && <Notice tone="demo">{t('plan.demoNote')}</Notice>}
          {result.suggestions.length > 0 && (
            <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">
              {result.suggestions.map((sg, i) => (
                <li key={i}>
                  {sg.kind === 'increase_budget' && t('plan.suggest.increase_budget', { amount: formatDZD(sg.amount, locale) })}
                  {sg.kind === 'use_pantry' && t('plan.suggest.use_pantry', { items: sg.ingredientIds.map(ingName).join(', ') })}
                  {sg.kind === 'missing_prices' && t('plan.suggest.missing_prices', { items: sg.ingredientIds.map(ingName).join(', ') })}
                  {sg.kind === 'relax_exclusions' && t('plan.suggest.relax_exclusions')}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link to="/lists" className="mt-4 inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 shadow-sm" data-testid="open-list">
          {t('plan.openList')} ({toBuy.length})
        </Link>
      </div>

      {/* Nutrition Breakdown Card */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-ink">{t('plan.nutritionTitle')}</h2>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
            {t('plan.dailyAvg')}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="rounded-xl bg-canvas p-2.5 border border-line text-center">
            <span className="text-[11px] font-semibold text-muted block">{t('plan.caloriesPerServing')}</span>
            <span className="num text-xl font-black text-ink">{result.nutrition.dailyAveragePerServing.calories}</span>
            <span className="text-[10px] text-muted block">kcal</span>
          </div>
          <div className="rounded-xl bg-canvas p-2.5 border border-line text-center">
            <span className="text-[11px] font-semibold text-muted block">{t('plan.proteinPerServing')}</span>
            <span className="num text-xl font-black text-brand-700">{result.nutrition.dailyAveragePerServing.protein}g</span>
          </div>
          <div className="rounded-xl bg-canvas p-2.5 border border-line text-center">
            <span className="text-[11px] font-semibold text-muted block">{t('plan.carbsPerServing')}</span>
            <span className="num text-xl font-black text-ink">{result.nutrition.dailyAveragePerServing.carbs}g</span>
          </div>
          <div className="rounded-xl bg-canvas p-2.5 border border-line text-center">
            <span className="text-[11px] font-semibold text-muted block">{t('plan.fatPerServing')}</span>
            <span className="num text-xl font-black text-ink">{result.nutrition.dailyAveragePerServing.fat}g</span>
          </div>
          <div className="rounded-xl bg-canvas p-2.5 border border-line text-center col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-muted block">{t('plan.fiberPerServing')}</span>
            <span className="num text-xl font-black text-ink">{result.nutrition.dailyAveragePerServing.fiber}g</span>
          </div>
        </div>
      </div>

      {/* 7-Day Planned Meals Calendar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">{t('plan.result')}</h2>
          <p className="text-xs text-muted">{t('plan.servings', { n: household })}</p>
        </div>

        <ol className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {days.map((meals, i) => {
            const dayNutrition = result.nutrition.byDay[i]?.perServing;
            return (
              <li key={i} className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs" data-testid="plan-day">
                <div className="flex items-center justify-between border-b border-line bg-canvas/70 px-3.5 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-2">
                    {t('plan.day', { n: i + 1 })}
                  </span>
                  {dayNutrition && (
                    <span className="num text-[11px] font-semibold text-muted">
                      {dayNutrition.calories} kcal • {dayNutrition.protein}g protein
                    </span>
                  )}
                </div>

                {meals.map((m) => {
                  const r = catalog.recipes.find((x) => x.id === m.recipeId)!;
                  const key = `${m.day}-${m.slot}`;
                  const open = openMeal === key;
                  const isReplacing = replacingSlot?.day === m.day && replacingSlot?.slot === m.slot;

                  return (
                    <div key={key} className="border-b border-line last:border-b-0">
                      <div className="flex items-center justify-between px-3.5 py-2.5 gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenMeal(open ? null : key)}
                          aria-expanded={open}
                          className="flex flex-1 items-center gap-2 text-start min-w-0"
                        >
                          <Badge tone="neutral">{t(`plan.${m.slot}`)}</Badge>
                          <span className="truncate text-sm font-semibold text-ink">{name(r)}</span>
                          <ChevronDown className={cx('size-4 text-muted transition-transform shrink-0', open && 'rotate-180')} aria-hidden />
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplacingSlot(isReplacing ? null : { day: m.day, slot: m.slot })}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 shrink-0"
                          title={t('plan.replaceMeal')}
                        >
                          <RefreshCw className="size-3" />
                          <span>{t('plan.replaceMeal')}</span>
                        </button>
                      </div>

                      {/* Modal/Inline Selector to Replace this specific meal */}
                      {isReplacing && (
                        <div className="p-3 bg-brand-50/40 border-t border-brand-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-brand-900">{t('plan.chooseReplacement')}</span>
                            <button
                              type="button"
                              onClick={() => setReplacingSlot(null)}
                              className="text-muted hover:text-ink"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {catalog.recipes
                              .filter((alt) => alt.id !== r.id && alt.meal_slots.includes(m.slot))
                              .map((alt) => (
                                <button
                                  key={alt.id}
                                  type="button"
                                  onClick={() => onSwapMeal(m.day, m.slot, alt.id)}
                                  className="flex w-full items-center justify-between rounded-xl border border-line bg-surface p-2 text-start hover:border-brand-500 hover:bg-brand-50 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-ink truncate">{name(alt)}</p>
                                    <p className="text-[10px] text-muted truncate">
                                      {alt.ingredients.slice(0, 3).map((ri) => ingName(ri.ingredient_id)).join(', ')}
                                    </p>
                                  </div>
                                  <span className="text-xs font-bold text-brand-700 shrink-0">✓ Select</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed Recipe Steps and Ingredients */}
                      {open && (
                        <div className="space-y-2 px-3.5 pb-3 text-sm bg-canvas/40">
                          <p className="text-xs font-semibold text-muted">{t('plan.ingredients')}</p>
                          <ul className="space-y-0.5">
                            {r.ingredients.map((ri) => {
                              const ing = catalog.ingredients.find((x) => x.id === ri.ingredient_id)!;
                              return (
                                <li key={ri.ingredient_id} className="flex justify-between gap-2 text-xs">
                                  <span>{name(ing)}</span>
                                  <span className="num text-muted font-semibold">
                                    {formatBaseQuantity(toBaseQuantity(ri.quantity, ri.unit).times(scale), ing.dimension, qtyLabels)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          <p className="text-xs font-semibold text-muted pt-1">{t('plan.steps')}</p>
                          <ol className="list-decimal space-y-0.5 ps-5 text-xs text-ink-2">
                            {(r.steps[locale] ?? r.steps.en ?? []).map((st, j) => (
                              <li key={j}>{st}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
