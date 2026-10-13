import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, Info } from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { Big, formatDZD, parseQuantity, sumMoney, stripZeros } from '../domain/money';
import { formatDate } from '../domain/dates';
import { baseToComparison, COMPARISON_UNIT, UNITS, formatBaseQuantity } from '../domain/units';
import { lineCost, type ShoppingLine } from '../planner/shoppingList';
import { loadEdits, loadPlan, saveEdits, type ListEdits } from '../planner/storage';
import { useI18n } from '../i18n/I18nProvider';
import { Badge, Button, Notice, PageContainer, Spinner, TextInput, cx } from '../components/ui';
import { DemoBadge } from '../components/PriceBits';

/** Informational checklist derived from the meal plan and pantry. Not a cart. */
export default function ListsPage() {
  const { t, name, locale } = useI18n();
  const { catalog } = useAppData();
  const [plan] = useState(loadPlan);
  const [edits, setEdits] = useState<ListEdits>(loadEdits);

  const setEdit = (id: string, patch: ListEdits[string]) => {
    const next = { ...edits, [id]: { ...edits[id], ...patch } };
    setEdits(next);
    saveEdits(next);
  };

  const rows = useMemo(() => {
    if (!plan) return [];
    return plan.lines
      .filter((l) => !l.isStaple && new Big(l.remainingBase).gt(0))
      .map((l) => {
        const e = edits[l.ingredientId] ?? {};
        const qtyBase = e.quantityBase ?? l.remainingBase;
        return { line: l, qtyBase, acquired: Boolean(e.acquired), cost: lineCost(qtyBase, l.dimension, l.price) };
      });
  }, [plan, edits]);

  if (!catalog.data) return <Spinner />;
  const cat = catalog.data;

  if (!plan) {
    return (
      <PageContainer>
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong p-8 text-center">
          <ClipboardList className="size-8 text-muted" aria-hidden />
          <p className="text-sm text-ink-2">{t('list.empty')}</p>
          <Link to="/plan" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white">
            {t('list.toPlan')}
          </Link>
        </div>
      </PageContainer>
    );
  }

  const remaining = rows.filter((r) => !r.acquired);
  const remainingCost = sumMoney(remaining.filter((r) => r.cost !== null).map((r) => r.cost!));
  const unknown = remaining.filter((r) => r.cost === null).length;
  const covered = plan.lines.filter((l) => !l.isStaple && new Big(l.remainingBase).eq(0));
  const staples = plan.lines.filter((l) => l.isStaple);
  const ing = (id: string) => cat.ingredients.find((i) => i.id === id);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">{t('list.title')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('list.intro')}</p>
      <p className="mt-1 text-xs text-muted">{t('list.fromPlan', { date: formatDate(plan.createdAt.slice(0, 10), locale) })}</p>

      <div className="sticky top-0 z-10 mt-4 rounded-lg border border-line bg-surface p-3 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-muted">{t('list.remaining')}</span>
          <span className="num text-xl font-extrabold" data-testid="list-total">
            {unknown ? '≥ ' : ''}
            {formatDZD(remainingCost, locale)}
          </span>
        </div>
        {unknown > 0 && <p className="mt-1 text-xs text-warn">{t('list.unknownItems', { n: unknown })}</p>}
      </div>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface" aria-label={t('list.toBuy')}>
        {rows.map(({ line, qtyBase, acquired, cost }) => (
          <ListRow
            key={line.ingredientId}
            line={line}
            label={ing(line.ingredientId) ? name(ing(line.ingredientId)!) : line.ingredientId}
            qtyBase={qtyBase}
            acquired={acquired}
            cost={cost}
            onToggle={() => setEdit(line.ingredientId, { acquired: !acquired })}
            onQty={(base) => setEdit(line.ingredientId, { quantityBase: base })}
          />
        ))}
      </ul>
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={() => { setEdits({}); saveEdits({}); }}>
          {t('list.reset')}
        </Button>
      </div>

      {covered.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{t('list.inPantry')}</h2>
          <p className="mt-1 text-sm text-ink-2">{covered.map((l) => (ing(l.ingredientId) ? name(ing(l.ingredientId)!) : l.ingredientId)).join(', ')}</p>
        </div>
      )}
      {staples.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{t('list.staple')}</h2>
          <p className="mt-1 text-sm text-ink-2">{staples.map((l) => (ing(l.ingredientId) ? name(ing(l.ingredientId)!) : l.ingredientId)).join(', ')}</p>
        </div>
      )}
      <div className="mt-4">
        <Notice icon={<Info className="size-4" aria-hidden />}>{t('list.intro')}</Notice>
      </div>
    </PageContainer>
  );
}

function ListRow({
  line,
  label,
  qtyBase,
  acquired,
  cost,
  onToggle,
  onQty,
}: {
  line: ShoppingLine;
  label: string;
  qtyBase: string;
  acquired: boolean;
  cost: string | null;
  onToggle: () => void;
  onQty: (base: string) => void;
}) {
  const { t, locale, qtyLabels } = useI18n();
  const unit = COMPARISON_UNIT[line.dimension];
  const shown = stripZeros(baseToComparison(qtyBase, line.dimension).round(3).toFixed(3));
  const [draft, setDraft] = useState(shown);
  const p = line.price;
  const id = `qty-${line.ingredientId}`;

  return (
    <li className={cx('flex flex-wrap items-start gap-3 px-3 py-3', acquired && 'bg-canvas')} data-testid="list-row">
      <input type="checkbox" checked={acquired} onChange={onToggle} aria-label={`${t('list.acquired')}: ${label}`} className="mt-1 size-5 shrink-0 accent-brand-600" />
      <div className="min-w-0 flex-1">
        <p className={cx('text-[15px] font-semibold', acquired && 'text-muted line-through')}>{label}</p>
        <p className="text-xs text-muted">
          {p?.basis === 'recent' && p.observedFrom && p.observedTo && t('list.basis.recent', { n: p.shopCount, from: formatDate(p.observedFrom, locale), to: formatDate(p.observedTo, locale) })}
          {p?.basis === 'stale' && p.observedTo && t('list.basis.stale', { to: formatDate(p.observedTo, locale) })}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {p?.basis === 'stale' && <Badge tone="stale">{t('fresh.stale')}</Badge>}
          {p?.isDemo && <DemoBadge />}
          {p?.productId && (
            <Link to={`/?product=${p.productId}`} className="text-xs font-semibold text-brand-700 hover:underline">
              {t('list.compare')} →
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <label htmlFor={id} className="sr-only">
            {t('list.quantity')}
          </label>
          <TextInput
            id={id}
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 8))}
            onBlur={() => {
              const q = parseQuantity(draft);
              if (q === null) {
                setDraft(shown);
                return;
              }
              const base = new Big(q).times(UNITS[unit].toBase).round(0, Big.roundUp).toFixed(0);
              onQty(base);
            }}
            className="num h-8 w-20 text-end text-sm"
          />
          <span className="w-8 text-xs text-muted">{t(`common.unit.${unit}`)}</span>
        </div>
        <span className="text-[11px] text-muted">{formatBaseQuantity(qtyBase, line.dimension, qtyLabels)}</span>
        {cost === null ? (
          <Badge tone="warn">{t('list.priceUnknown')}</Badge>
        ) : (
          <span className="num text-sm font-bold">{formatDZD(cost, locale)}</span>
        )}
      </div>
    </li>
  );
}
