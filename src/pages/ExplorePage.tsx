import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronUp, Info, List, LocateFixed, Map as MapIcon, PlusCircle, SlidersHorizontal, Store, UtensilsCrossed } from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { ALGERIA_VIEW } from '../data/reference/geography';
import { useAsync } from '../lib/useAsync';
import { DESKTOP_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import { buildComparison, type ComparisonRow, type SortKey } from '../domain/comparison';
import { Big, parseMoney } from '../domain/money';
import { searchProducts } from '../domain/search';
import { formatDate } from '../domain/dates';
import { COMPARISON_UNIT } from '../domain/units';
import type { Catalog, Product, Shop } from '../domain/types';
import { platform } from '../platform/platform';
import PriceMap, { type MapMarker } from '../map/PriceMap';
import { useI18n } from '../i18n/I18nProvider';
import { SearchBox } from '../components/SearchBox';
import { ComparisonList, ComparisonRowItem } from '../components/ComparisonList';
import { ShopPanel } from '../components/ShopPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Badge, ErrorState, Notice, Select, Spinner, TextInput, cx } from '../components/ui';

type SheetState = 'peek' | 'half' | 'full';
type FreshFilter = 'current' | 'recent' | 'all';

const POPULAR = ['potatoes', 'eggs', 'tomatoes', 'onions', 'milk-pasteurised-bag', 'chicken-whole', 'lentils', 'baguette'];
const OBS_LIMIT = 500;
const SHEET_HEIGHT: Record<SheetState, string> = { peek: '7.5rem', half: '48%', full: 'calc(100% - 0.5rem)' };
/** Approximate share of the map hidden by the sheet, used to keep markers visible. */
const SHEET_INSET: Record<SheetState, number> = { peek: 0.2, half: 0.55, full: 0.9 };

function priceText(v: string): string {
  const b = new Big(v);
  return b.mod(1).eq(0) ? b.toFixed(0) : b.toFixed(2);
}

export default function ExplorePage({ mode }: { mode: 'explore' | 'map' }) {
  const { t, name, locale } = useI18n();
  const { catalog, shops, coverage, wilaya, wilayaCode, today, origin, setOrigin, repo } = useAppData();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState<SheetState>(mode === 'explore' ? 'half' : 'peek');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied' | 'unavailable'>('idle');
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // Explore opens with the results sheet half-open; Map keeps the map unobstructed.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setSheet(mode === 'explore' ? 'half' : 'peek');
  }

  const productId = params.get('product');
  const shopId = params.get('shop');
  const query = params.get('q') ?? '';
  const view = params.get('view') === 'list' ? 'list' : 'map';
  const sortParam = (params.get('sort') as SortKey | null) ?? 'price';
  const sort: SortKey = sortParam === 'distance' && !origin ? 'price' : sortParam;
  const fresh = (params.get('fresh') as FreshFilter | null) ?? 'current';
  const areaFilter = params.get('area') ?? '';
  const minPrice = params.get('min') ? parseMoney(params.get('min')!) : null;
  const maxPrice = params.get('max') ? parseMoney(params.get('max')!) : null;

  function update(patch: Record<string, string | null>, replace = false) {
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') n.delete(k);
          else n.set(k, v);
        }
        return n;
      },
      { replace },
    );
  }

  const cat = catalog.data;
  const product = cat?.products.find((p) => p.id === productId) ?? null;
  const matches = useMemo(
    () => (cat && query ? searchProducts(cat.products, cat.categories, query, 6).map((m) => m.product) : []),
    [cat, query],
  );

  const productObs = useAsync(
    () => (product ? repo.listObservations({ wilayaCode, productIds: [product.id], limit: OBS_LIMIT, offset: 0 }) : Promise.resolve(null)),
    [repo, product?.id, wilayaCode],
  );

  const comparison = useMemo(() => {
    if (!product || !productObs.data || !shops.data || !cat) return null;
    return buildComparison({ product, observations: productObs.data.items, shops: shops.data, categories: cat.categories, today, sort, origin });
  }, [product, productObs.data, shops.data, cat, today, sort, origin]);

  const visibleRows = useMemo(() => {
    if (!comparison) return [];
    return comparison.rows.filter((r) => {
      if (fresh === 'current' && r.freshness.state === 'stale') return false;
      if (fresh === 'recent' && r.freshness.state !== 'recent') return false;
      if (areaFilter && r.shop.area_id !== areaFilter) return false;
      const v = new Big(r.observation.normalized_price!);
      if (minPrice && v.lt(minPrice)) return false;
      if (maxPrice && v.gt(maxPrice)) return false;
      return true;
    });
  }, [comparison, fresh, areaFilter, minPrice, maxPrice]);

  const selectedShop = shops.data?.find((s) => s.id === shopId) ?? null;
  // Selecting a shop reveals its details.
  const [prevShopId, setPrevShopId] = useState(shopId);
  if (prevShopId !== shopId) {
    setPrevShopId(shopId);
    if (shopId && sheet === 'peek') setSheet('half');
  }

  const markers: MapMarker[] = useMemo(() => {
    const rowByShop = new Map<string, ComparisonRow>(visibleRows.map((r) => [r.shop.id, r]));
    return (shops.data ?? []).map((s) => {
      const row = rowByShop.get(s.id);
      if (product && row) {
        return {
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          label: s.name,
          priceText: priceText(row.observation.normalized_price!),
          unitText: t(`common.perUnit.${row.observation.comparison_unit}`),
          state: row.isLowestReported ? 'lowest' : row.freshness.state,
          demo: s.is_demo,
        };
      }
      return { id: s.id, lat: s.lat, lng: s.lng, label: s.name, state: product ? 'none' : 'recent', demo: s.is_demo };
    });
  }, [shops.data, visibleRows, product, t]);

  const center = wilaya?.center_lat != null && wilaya.center_lng != null ? { lat: wilaya.center_lat, lng: wilaya.center_lng } : { lat: ALGERIA_VIEW.lat, lng: ALGERIA_VIEW.lng };
  const zoom = wilaya?.default_zoom ?? ALGERIA_VIEW.zoom;

  function selectProduct(p: Product, q?: string) {
    update({ product: p.id, q: q ?? null, shop: null });
    setSheet((s) => (s === 'peek' ? 'half' : s));
  }

  async function nearMe() {
    setLocating('busy');
    try {
      const pos = await platform.getCurrentPosition();
      setOrigin(pos);
      setLocating('idle');
      update({ sort: 'distance' }, true);
    } catch (e) {
      setLocating((e as Error).message === 'denied' ? 'denied' : 'unavailable');
    }
  }

  // --- Bottom sheet drag (mobile) ------------------------------------------
  const drag = useRef<{ y: number } | null>(null);
  const order: SheetState[] = ['peek', 'half', 'full'];
  const onHandleDown = (e: ReactPointerEvent) => {
    drag.current = { y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleUp = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    const i = order.indexOf(sheet);
    if (dy < -30) setSheet(order[Math.min(i + 1, 2)]!);
    else if (dy > 30) setSheet(order[Math.max(i - 1, 0)]!);
    else setSheet(order[(i + 1) % 3]!);
  };

  const searchBlock = (
    <div className="space-y-2">
      <SearchBox
        key={`${product?.id ?? 'none'}:${locale}`}
        catalog={cat}
        initialQuery={product ? name(product) : ''}
        onSelect={(p, q) => selectProduct(p, q)}
        onClear={() => update({ product: null, q: null, shop: null })}
      />
      <div className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
        {cat &&
          POPULAR.map((id) => cat.products.find((p) => p.id === id))
            .filter((p): p is Product => Boolean(p))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p)}
                aria-pressed={p.id === productId}
                className={cx(
                  'h-8 shrink-0 rounded-md border px-2.5 text-[13px] font-semibold',
                  p.id === productId ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-surface text-ink-2 hover:bg-canvas',
                )}
              >
                {name(p)}
              </button>
            ))}
      </div>
    </div>
  );

  const areaName = wilaya ? name(wilaya) : '';
  const noShops = shops.status === 'success' && shops.data.length === 0;

  const peekSummary = selectedShop ? selectedShop.name : product ? name(product) : t('explore.intro.title');

  let panel: ReactNode;
  if (!cat) {
    panel = catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />;
  } else if (selectedShop) {
    panel = (
      <ShopPanel
        shop={selectedShop}
        product={product}
        productObservations={productObs.data?.items ?? []}
        catalog={cat}
        onBack={() => update({ shop: null })}
      />
    );
  } else if (product) {
    panel = (
      <ProductPanel
        product={product}
        catalog={cat}
        matches={matches}
        onPickMatch={(p) => selectProduct(p, query)}
        loading={productObs.status === 'loading' || shops.status === 'loading'}
        error={productObs.status === 'error' || shops.status === 'error'}
        onRetry={() => {
          productObs.reload();
          shops.reload();
        }}
        rows={visibleRows}
        allRowsCount={comparison?.rows.length ?? 0}
        coverage={comparison?.coverage ?? 'none'}
        currentShopCount={comparison?.currentShopCount ?? 0}
        truncated={(productObs.data?.total ?? 0) > OBS_LIMIT}
        areaName={areaName}
        today={today}
        sort={sort}
        hasOrigin={Boolean(origin)}
        onSort={(s) => update({ sort: s }, true)}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        fresh={fresh}
        areaFilter={areaFilter}
        min={params.get('min') ?? ''}
        max={params.get('max') ?? ''}
        onFilter={(patch) => update(patch, true)}
        selectedShopId={shopId}
        onSelectShop={(id) => update({ shop: id })}
      />
    );
  } else {
    panel = (
      <IntroPanel
        areaName={areaName}
        noShops={noShops}
        coverage={coverage.data}
        shopsLoading={shops.status === 'loading'}
        shopsError={shops.status === 'error'}
        onRetry={shops.reload}
      />
    );
  }

  return (
    <div className="relative flex h-full flex-col lg:flex-row">
      {/* Mobile: search sits directly under the header, above the map. */}
      <div className="z-[1001] shrink-0 border-b border-line bg-surface px-3 py-2 lg:hidden">{searchBlock}</div>

      {/* Results: bottom sheet on mobile, side panel on desktop. */}
      <aside
        aria-label={t('compare.title')}
        style={{ ['--sheet-h' as string]: SHEET_HEIGHT[sheet] }}
        className={cx(
          'absolute inset-x-0 bottom-0 z-[1000] flex h-[var(--sheet-h)] flex-col rounded-t-lg bg-surface shadow-sheet transition-[height] duration-200',
          'lg:static lg:order-first lg:h-full lg:w-[420px] lg:shrink-0 lg:rounded-none lg:border-e lg:border-line lg:shadow-none',
          view === 'list' && !selectedShop && 'max-lg:hidden',
        )}
      >
        <div className="hidden border-b border-line p-3 lg:block">{searchBlock}</div>
        <div className="flex shrink-0 items-center gap-2 px-3 pt-1.5 lg:hidden">
          <button
            type="button"
            onPointerDown={onHandleDown}
            onPointerUp={onHandleUp}
            aria-label={sheet === 'full' ? t('explore.collapse') : t('explore.expand')}
            aria-expanded={sheet !== 'peek'}
            className="flex min-w-0 flex-1 touch-none flex-col items-center gap-1 pb-1"
          >
            <span className="h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            <span className="flex w-full items-center gap-1.5 text-start">
              <ChevronUp className={cx('size-4 shrink-0 text-muted transition-transform', sheet === 'full' && 'rotate-180')} aria-hidden />
              <span className="truncate text-sm font-bold text-ink">{peekSummary}</span>
            </span>
          </button>
          <Link
            to={`/contribute${product ? `?product=${product.id}` : ''}`}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-brand-600 px-2.5 text-[13px] font-semibold text-white"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t('nav.report')}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4" data-testid="results-panel">
          {panel}
        </div>
      </aside>

      {/* Map (or accessible list alternative). */}
      <section className="relative min-h-0 flex-1" aria-label={t('explore.mapLabel')}>
        {view === 'map' ? (
          <ErrorBoundary fallback={<ErrorState message={t('explore.mapError')} />}>
            <PriceMap
              center={center}
              zoom={zoom}
              markers={markers}
              selectedId={shopId}
              onSelect={(id) => update({ shop: id })}
              userPosition={origin}
              fitKey={
                product && visibleRows.length
                  ? `${product.id}:${wilayaCode}:${visibleRows.length}`
                  : markers.length
                    ? `shops:${wilayaCode}:${markers.length}`
                    : undefined
              }
              bottomInset={isDesktop || view !== 'map' ? 0 : SHEET_INSET[sheet]}
              ariaLabel={t('explore.mapLabel')}
            />
          </ErrorBoundary>
        ) : (
          <div className="h-full overflow-y-auto bg-surface pb-24 lg:pb-4">
            {cat && (
              <ShopListView
                shops={shops.data ?? []}
                rows={visibleRows}
                product={product}
                catalog={cat}
                today={today}
                areaName={areaName}
                selectedShopId={shopId}
                onSelect={(id) => update({ shop: id })}
              />
            )}
          </div>
        )}

        <div className="absolute start-3 top-3 z-[1000] flex flex-col items-start gap-2">
          <div role="group" aria-label={t('explore.viewToggle')} className="flex overflow-hidden rounded-md border border-line-strong bg-surface shadow-card">
            {(['map', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => update({ view: v === 'map' ? null : 'list' }, true)}
                className={cx('inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-semibold', view === v ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-canvas')}
              >
                {v === 'map' ? <MapIcon className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
                {t(v === 'map' ? 'explore.mapView' : 'explore.listView')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={origin ? () => { setOrigin(null); update({ sort: null }, true); } : nearMe}
            disabled={locating === 'busy'}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink-2 shadow-card hover:bg-canvas"
          >
            <LocateFixed className={cx('size-4', origin && 'text-[#2563eb]')} aria-hidden />
            {locating === 'busy' ? t('location.locating') : origin ? t('location.clear') : t('location.nearMe')}
          </button>
          {(locating === 'denied' || locating === 'unavailable') && (
            <p role="alert" className="max-w-[16rem] rounded-md bg-surface p-2 text-xs text-ink-2 shadow-card">
              {t(locating === 'denied' ? 'location.denied' : 'location.unavailable')}
            </p>
          )}
        </div>
        {!wilaya?.center_lat && wilaya && (
          <p className="absolute inset-x-3 bottom-36 z-[999] mx-auto max-w-sm rounded-md bg-surface/95 p-2 text-center text-xs text-ink-2 shadow-card lg:bottom-6">
            {t('location.noCenter')}
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IntroPanel({
  areaName,
  noShops,
  coverage,
  shopsLoading,
  shopsError,
  onRetry,
}: {
  areaName: string;
  noShops: boolean;
  coverage: import('../data/repository').AreaCoverage | undefined;
  shopsLoading: boolean;
  shopsError: boolean;
  onRetry: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="space-y-3 px-4 py-3">
      {shopsError && <ErrorState onRetry={onRetry} />}
      {noShops ? (
        <div className="rounded-md border border-dashed border-line-strong p-4" data-testid="empty-area">
          <h2 className="text-base font-bold">{t('explore.empty.title')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t('explore.empty.body', { area: areaName })}</p>
        </div>
      ) : (
        <div>
          <h2 className="text-base font-bold text-ink">{t('explore.intro.title')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t('explore.intro.body')}</p>
        </div>
      )}
      {shopsLoading && <Spinner />}
      {coverage && (
        <div className="rounded-md border border-line p-3 text-[13px]" data-testid="coverage">
          <p className="font-semibold text-ink">{t('explore.coverage.title', { area: areaName })}</p>
          <p className="mt-1 text-ink-2">
            {coverage.approvedReports > 0
              ? t('explore.coverage.real', { shops: coverage.shopsWithReports, reports: coverage.approvedReports })
              : t('explore.coverage.noReal')}
          </p>
          {coverage.demoReports > 0 && (
            <p className="mt-1 text-demo">{t('explore.coverage.demo', { shops: coverage.demoShopCount, reports: coverage.demoReports })}</p>
          )}
          {coverage.lastObservedOn && <p className="mt-1 text-muted">{t('explore.coverage.last', { date: formatDate(coverage.lastObservedOn, locale) })}</p>}
        </div>
      )}
      <Link to="/plan" className="flex items-center gap-2 rounded-md border border-line p-3 text-sm font-semibold text-brand-700 hover:bg-canvas">
        <UtensilsCrossed className="size-4" aria-hidden />
        {t('explore.planShortcut')} →
      </Link>
    </div>
  );
}

interface ProductPanelProps {
  product: Product;
  catalog: Catalog;
  matches: Product[];
  onPickMatch: (p: Product) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  rows: ComparisonRow[];
  allRowsCount: number;
  coverage: import('../domain/comparison').CoverageLevel;
  currentShopCount: number;
  truncated: boolean;
  areaName: string;
  today: string;
  sort: SortKey;
  hasOrigin: boolean;
  onSort: (s: SortKey) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  fresh: FreshFilter;
  areaFilter: string;
  min: string;
  max: string;
  onFilter: (patch: Record<string, string | null>) => void;
  selectedShopId: string | null;
  onSelectShop: (id: string) => void;
}

function ProductPanel(p: ProductPanelProps) {
  const { t, name, variant } = useI18n();
  const unit = COMPARISON_UNIT[p.product.dimension];
  const areas = p.catalog.areas.filter((a) => p.rows.some((r) => r.shop.area_id === a.id) || a.id === p.areaFilter);
  const anyLowest = p.rows.some((r) => r.isLowestReported);
  const filtersActive = p.fresh !== 'current' || p.areaFilter || p.min || p.max;

  return (
    <div data-testid="product-panel">
      <div className="px-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-6 text-ink">
              {name(p.product)}
              {variant(p.product) && <span className="ms-1.5 text-sm font-medium text-muted">{variant(p.product)}</span>}
            </h2>
            <p className="text-xs text-muted">{t('product.comparedPer', { unit: t(`common.unit.${unit}`) })}</p>
          </div>
          <Link to={`/product/${p.product.id}`} className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">
            {t('compare.viewHistory')} →
          </Link>
        </div>

        {p.matches.length > 1 && (
          <div className="mt-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('compare.matches')}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => p.onPickMatch(m)}
                  aria-pressed={m.id === p.product.id}
                  className={cx('rounded-md border px-2 py-1 text-xs font-semibold', m.id === p.product.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-2')}
                >
                  {name(m)}
                  {variant(m) ? ` · ${variant(m)}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="sort" className="text-xs font-semibold text-muted">
            {t('compare.sortBy')}
          </label>
          <Select id="sort" value={p.sort} onChange={(e) => p.onSort(e.target.value as SortKey)} className="h-8 w-auto flex-1 text-[13px]">
            <option value="price">{t('compare.sort.price')}</option>
            <option value="freshness">{t('compare.sort.freshness')}</option>
            <option value="distance" disabled={!p.hasOrigin}>
              {t('compare.sort.distance')}
            </option>
          </Select>
          <button
            type="button"
            onClick={() => p.setFiltersOpen(!p.filtersOpen)}
            aria-expanded={p.filtersOpen}
            className={cx('inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[13px] font-semibold', filtersActive ? 'border-brand-500 text-brand-700' : 'border-line-strong text-ink-2')}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t('compare.filters')}
          </button>
        </div>
        {!p.hasOrigin && <p className="mt-1 text-[11px] text-muted">{t('compare.distanceNeedsLocation')}</p>}

        {p.filtersOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-canvas p-2.5">
            <label className="col-span-2 text-xs font-semibold text-muted">
              {t('compare.filter.freshness')}
              <Select value={p.fresh} onChange={(e) => p.onFilter({ fresh: e.target.value === 'current' ? null : e.target.value })} className="mt-1 h-9 text-sm">
                <option value="current">{t('compare.filter.fresh.current')}</option>
                <option value="recent">{t('compare.filter.fresh.recent')}</option>
                <option value="all">{t('compare.filter.fresh.all')}</option>
              </Select>
            </label>
            <label className="col-span-2 text-xs font-semibold text-muted">
              {t('compare.filter.area')}
              <Select value={p.areaFilter} onChange={(e) => p.onFilter({ area: e.target.value || null })} className="mt-1 h-9 text-sm">
                <option value="">{t('compare.filter.allAreas')}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {name(a)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-muted">
              {t('compare.filter.minPrice', { unit: t(`common.perUnit.${unit}`) })}
              <TextInput inputMode="decimal" value={p.min} onChange={(e) => p.onFilter({ min: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) || null })} className="mt-1 h-9 text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted">
              {t('compare.filter.maxPrice', { unit: t(`common.perUnit.${unit}`) })}
              <TextInput inputMode="decimal" value={p.max} onChange={(e) => p.onFilter({ max: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) || null })} className="mt-1 h-9 text-sm" />
            </label>
            <button type="button" onClick={() => p.onFilter({ fresh: null, area: null, min: null, max: null })} className="col-span-2 text-start text-xs font-semibold text-brand-700 underline">
              {t('compare.filter.reset')}
            </button>
          </div>
        )}
      </div>

      {p.error && <ErrorState onRetry={p.onRetry} />}
      {p.loading && !p.error && <Spinner />}

      {!p.loading && !p.error && (
        <>
          <div className="space-y-2 px-4 pb-2" data-testid="coverage-notice">
            <Notice tone={p.coverage === 'limited' || p.coverage === 'adequate' ? 'neutral' : 'warn'} icon={<Info className="size-4" aria-hidden />}>
              {t(`compare.coverage.${p.coverage}`, { n: p.currentShopCount, area: p.areaName })}
            </Notice>
            {anyLowest && <p className="text-[11px] leading-4 text-muted">{t('compare.lowestNote')}</p>}
            {p.truncated && <p className="text-[11px] text-muted">{t('compare.truncated', { n: OBS_LIMIT })}</p>}
          </div>
          {p.allRowsCount > 0 && p.rows.length === 0 && <p className="px-4 py-3 text-sm text-muted">{t('compare.filteredOut')}</p>}
          <ComparisonList
            rows={p.rows}
            product={p.product}
            categories={p.catalog.categories}
            areas={p.catalog.areas}
            today={p.today}
            selectedShopId={p.selectedShopId}
            onSelect={p.onSelectShop}
          />
        </>
      )}
    </div>
  );
}

function ShopListView({
  shops,
  rows,
  product,
  catalog,
  today,
  areaName,
  selectedShopId,
  onSelect,
}: {
  shops: Shop[];
  rows: ComparisonRow[];
  product: Product | null;
  catalog: Catalog;
  today: string;
  areaName: string;
  selectedShopId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, name } = useI18n();
  const withRow = new Set(rows.map((r) => r.shop.id));
  const rest = shops.filter((s) => !withRow.has(s.id));
  return (
    <div className="pt-14 lg:pt-14" data-testid="shop-list-view">
      <h2 className="px-4 pb-2 text-sm font-bold text-ink">{t('explore.shopsInArea', { area: areaName })}</h2>
      {shops.length === 0 && <p className="px-4 text-sm text-muted">{t('explore.noShops')}</p>}
      {product && (
        <ul>
          {rows.map((r) => (
            <ComparisonRowItem
              key={r.shop.id}
              row={r}
              product={product}
              categories={catalog.categories}
              areas={catalog.areas}
              today={today}
              selected={selectedShopId === r.shop.id}
              onSelect={() => onSelect(r.shop.id)}
            />
          ))}
        </ul>
      )}
      {!product && rest.length > 0 && <p className="px-4 pb-2 text-xs text-muted">{t('explore.selectProductHint')}</p>}
      <ul>
        {rest.map((s) => {
          const area = catalog.areas.find((a) => a.id === s.area_id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={selectedShopId === s.id}
                className={cx('flex w-full items-center gap-3 border-b border-line px-4 py-3 text-start hover:bg-canvas', selectedShopId === s.id && 'bg-brand-50')}
              >
                <Store className="size-[18px] shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="block text-xs text-muted">
                    {t(`shop.kind.${s.kind}`)}
                    {area ? ` · ${name(area)}` : ''}
                  </span>
                </span>
                {s.is_demo && <Badge tone="demo">{t('common.demo')}</Badge>}
                {product && <span className="text-xs text-muted">{t('shop.noObservationForProduct', { product: name(product) })}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
