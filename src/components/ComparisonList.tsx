import { ChevronRight, Store } from 'lucide-react';
import type { ComparisonRow } from '../domain/comparison';
import type { Category, LocalArea, Product } from '../domain/types';
import { thresholdsFor } from '../domain/freshness';
import { useI18n } from '../i18n/I18nProvider';
import { CorroboratedBadge, DemoBadge, FreshnessBadge, ObservedDate, ReportedPackage, UnitPrice } from './PriceBits';
import { Badge, cx } from './ui';

interface Props {
  rows: ComparisonRow[];
  product: Product;
  categories: Category[];
  areas: LocalArea[];
  today: string;
  selectedShopId: string | null;
  onSelect: (shopId: string) => void;
}

export function ComparisonRowItem({ row, product, categories, areas, today, selected, onSelect }: Omit<Props, 'rows' | 'selectedShopId' | 'onSelect'> & { row: ComparisonRow; selected: boolean; onSelect: () => void }) {
  const { t, name } = useI18n();
  const area = areas.find((a) => a.id === row.shop.area_id);
  const { recent_days } = thresholdsFor(product.category_id, categories);
  const o = row.observation;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        data-testid="comparison-row"
        className={cx(
          'flex w-full items-start gap-3 border-b border-line px-4 py-3 text-start transition-colors hover:bg-canvas',
          selected && 'bg-brand-50 hover:bg-brand-50',
          row.freshness.state === 'stale' && 'opacity-75',
        )}
      >
        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-canvas text-ink-2">
          <Store className="size-[18px]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-semibold text-ink">{row.shop.name}</p>
          </div>
          <p className="truncate text-xs text-muted">
            {t(`shop.kind.${row.shop.kind}`)}
            {area ? ` · ${name(area)}` : ''}
            {row.distanceKm !== null ? ` · ${t('common.km', { n: row.distanceKm.toFixed(1) })}` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {row.isLowestReported && <Badge tone="brand">{t('compare.lowestReported')}</Badge>}
            <FreshnessBadge f={row.freshness} recentDays={recent_days} />
            {o.is_demo && <DemoBadge />}
            <CorroboratedBadge n={o.corroborating_reports} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
          <UnitPrice value={o.normalized_price} unit={o.comparison_unit} />
          <ReportedPackage o={o} />
          <ObservedDate date={o.observed_on} today={today} />
        </div>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
      </button>
    </li>
  );
}

export function ComparisonList(props: Props) {
  const { t } = useI18n();
  const current = props.rows.filter((r) => r.freshness.state !== 'stale');
  const stale = props.rows.filter((r) => r.freshness.state === 'stale');
  const render = (r: ComparisonRow) => (
    <ComparisonRowItem
      key={r.shop.id}
      row={r}
      product={props.product}
      categories={props.categories}
      areas={props.areas}
      today={props.today}
      selected={props.selectedShopId === r.shop.id}
      onSelect={() => props.onSelect(r.shop.id)}
    />
  );
  return (
    <div>
      {current.length > 0 && <ul aria-label={t('compare.title')}>{current.map(render)}</ul>}
      {stale.length > 0 && (
        <>
          <h3 className="bg-canvas px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{t('compare.staleSection')}</h3>
          <ul aria-label={t('compare.staleSection')}>{stale.map(render)}</ul>
        </>
      )}
    </div>
  );
}
