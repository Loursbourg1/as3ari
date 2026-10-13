import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Minus, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { Big, formatDZD, parseMoney, parseQuantity } from '../domain/money';
import { addDays } from '../domain/dates';
import { BASE_UNIT, formatBaseQuantity, toBaseQuantity, unitsForDimension } from '../domain/units';
import type { Catalog, DietTag, UnitCode } from '../domain/types';
import { estimateIngredientPrices } from '../planner/prices';
import { generateMealPlan, type MealPlanResult } from '../planner/planner';
import { loadForm, saveForm, savePlan, type PlannerForm } from '../planner/storage';
import { useI18n } from '../i18n/I18nProvider';
import { Badge, Button, ErrorState, Field, Notice, PageContainer, Select, Spinner, TextInput, cx } from '../components/ui';

const TAGS: DietTag[] = ['red_meat', 'poultry', 'fish', 'egg', 'dairy', 'gluten', 'legume'];

export default function PlannerPage() {
  const { t, name, locale } = useI18n();
  const { catalog, repo, wilayaCode, wilaya, today } = useAppData();
  const [form, setForm] = useState<PlannerForm>(loadForm);
  const [result, setResult] = useState<MealPlanResult | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [openMeal, setOpenMeal] = useState<string | null>(null);

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
      // Ignore pantry rows with an invalid or empty quantity rather than guessing.
      const pantry = form.pantry.flatMap((p) => {
        const q = parseQuantity(p.quantity);
        const ing = cat!.ingredients.find((i) => i.id === p.ingredientId);
        return q && ing && unitsForDimension(ing.dimension).includes(p.unit) ? [{ ...p, quantity: q }] : [];
      });
      const r = generateMealPlan(
        { householdSize: size, budget, pantry, excludedTags: form.excludedTags, excludedIngredients: [], preferredIngredients: form.preferredIngredients },
        cat!,
        prices,
      );
      setResult(r);
      if (r.ok) {
        savePlan({ version: 1, createdAt: new Date().toISOString(), wilayaCode, householdSize: size, meals: r.meals, lines: r.lines, summary: r.summary });
      }
      setState('idle');
    } catch {
      setState('error');
    }
  }

  const ingName = (id: string) => {
    const i = cat.ingredients.find((x) => x.id === id);
    return i ? name(i) : id;
  };
  const costable = cat.ingredients.filter((i) => !i.is_staple);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-ink">{t('plan.title')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('plan.intro')}</p>

      <form
        className="mt-4 space-y-4 rounded-lg border border-line bg-surface p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        aria-label={t('plan.title')}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('plan.household')} htmlFor="household">
            <div className="flex items-center gap-1">
              <Button aria-label="−" onClick={() => update({ householdSize: Math.max(1, form.householdSize - 1) })} className="w-10 px-0">
                <Minus className="size-4" aria-hidden />
              </Button>
              <TextInput
                id="household"
                inputMode="numeric"
                value={String(form.householdSize)}
                onChange={(e) => update({ householdSize: Number(e.target.value.replace(/\D/g, '').slice(0, 2)) || 0 })}
                className="num w-14 text-center"
              />
              <Button aria-label="+" onClick={() => update({ householdSize: Math.min(20, form.householdSize + 1) })} className="w-10 px-0">
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
          </Field>
          <Field label={t('plan.budget')} htmlFor="budget">
            <TextInput id="budget" inputMode="decimal" placeholder="12000" value={form.budget} onChange={(e) => update({ budget: e.target.value.slice(0, 12) })} className="num" />
          </Field>
        </div>
        <p className="text-xs text-muted">
          {t('plan.area')}: <strong className="text-ink-2">{wilaya ? name(wilaya) : ''}</strong>
        </p>

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
                      pantry[idx] = { ingredientId: ni.id, quantity: item.quantity, unit: unitsForDimension(ni.dimension).includes(item.unit) ? item.unit : BASE_UNIT[ni.dimension] === 'g' ? 'kg' : BASE_UNIT[ni.dimension] === 'ml' ? 'l' : 'piece' };
                      update({ pantry });
                    }}
                    className="min-w-0 flex-1"
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
                    className="num w-20"
                  />
                  <Select
                    aria-label={t('contribute.unit')}
                    value={item.unit}
                    onChange={(e) => {
                      const pantry = [...form.pantry];
                      pantry[idx] = { ...item, unit: e.target.value as UnitCode };
                      update({ pantry });
                    }}
                    className="w-20"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {t(`common.unit.${u}`)}
                      </option>
                    ))}
                  </Select>
                  <button type="button" aria-label={t('plan.remove')} onClick={() => update({ pantry: form.pantry.filter((_, j) => j !== idx) })} className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-canvas">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <Button size="sm" className="mt-2" onClick={() => update({ pantry: [...form.pantry, { ingredientId: 'potato', quantity: '1', unit: 'kg' }] })}>
            <Plus className="size-4" aria-hidden />
            {t('plan.addPantry')}
          </Button>
        </fieldset>

        <fieldset>
          <legend className="text-[13px] font-semibold text-ink-2">{t('plan.exclusions')}</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TAGS.map((tag) => {
              const on = form.excludedTags.includes(tag);
              return (
                <label key={tag} className={cx('inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-medium', on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line-strong text-ink-2')}>
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
                  className={cx('rounded-md border px-2 py-1 text-xs font-medium', on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-2')}
                >
                  {name(i)}
                </button>
              );
            })}
          </div>
        </details>

        {formError && <p role="alert" className="text-sm font-medium text-danger">{formError}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={state === 'busy'}>
            {state === 'busy' ? t('plan.generating') : t('plan.generate')}
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

      {result?.ok && <PlanResult result={result} catalog={cat} openMeal={openMeal} setOpenMeal={setOpenMeal} ingName={ingName} locale={locale} />}

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
  ingName,
  locale,
}: {
  result: MealPlanResult;
  catalog: Catalog;
  openMeal: string | null;
  setOpenMeal: (k: string | null) => void;
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
      <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
        <p className="text-[13px] font-semibold text-muted">{t('plan.estimate')}</p>
        <p className="num mt-1 text-3xl font-extrabold text-ink" data-testid="plan-total">
          {s.missing.length ? '≥ ' : ''}
          {formatDZD(s.estimatedTotal, locale)}
        </p>
        {s.budget !== null && s.difference !== null && (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted">{t('plan.budgetLabel')}</dt>
              <dd className="num font-semibold">{formatDZD(s.budget, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('plan.difference')}</dt>
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
        <Link to="/lists" className="mt-4 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" data-testid="open-list">
          {t('plan.openList')} ({toBuy.length})
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-bold">{t('plan.result')}</h2>
        <p className="text-xs text-muted">{t('plan.servings', { n: household })}</p>
        <ol className="mt-2 grid gap-2 sm:grid-cols-2">
          {days.map((meals, i) => (
            <li key={i} className="rounded-md border border-line bg-surface" data-testid="plan-day">
              <p className="border-b border-line px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">{t('plan.day', { n: i + 1 })}</p>
              {meals.map((m) => {
                const r = catalog.recipes.find((x) => x.id === m.recipeId)!;
                const key = `${m.day}-${m.slot}`;
                const open = openMeal === key;
                return (
                  <div key={key} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={() => setOpenMeal(open ? null : key)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-start">
                      <Badge tone="neutral">{t(`plan.${m.slot}`)}</Badge>
                      <span className="flex-1 text-sm font-semibold">{name(r)}</span>
                      <ChevronDown className={cx('size-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
                    </button>
                    {open && (
                      <div className="space-y-2 px-3 pb-3 text-sm">
                        <p className="text-xs font-semibold text-muted">{t('plan.ingredients')}</p>
                        <ul className="space-y-0.5">
                          {r.ingredients.map((ri) => {
                            const ing = catalog.ingredients.find((x) => x.id === ri.ingredient_id)!;
                            return (
                              <li key={ri.ingredient_id} className="flex justify-between gap-2">
                                <span>{name(ing)}</span>
                                <span className="num text-muted">{formatBaseQuantity(toBaseQuantity(ri.quantity, ri.unit).times(scale), ing.dimension, qtyLabels)}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-xs font-semibold text-muted">{t('plan.steps')}</p>
                        <ol className="list-decimal space-y-0.5 ps-5">
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
          ))}
        </ol>
      </div>
    </section>
  );
}
