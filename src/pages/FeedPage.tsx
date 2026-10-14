import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  Camera,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  PlusCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  User,
  UtensilsCrossed,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { useI18n } from '../i18n/I18nProvider';
import { formatDate } from '../domain/dates';
import { Big } from '../domain/money';
import type { PriceObservation, Product } from '../domain/types';
import type { MessageKey } from '../i18n/en';
import { demoPhotoUrl } from '../data/demo/photos';
import { getReportRating, voteReport, getAccuracyPct, type ReportRating } from '../data/ratings';
import { Spinner, ErrorState, Badge, TextInput, Select } from '../components/ui';

const PAGE_SIZE = 30;

function formatPriceNumber(v: string): string {
  const b = new Big(v);
  return b.mod(1).eq(0) ? b.toFixed(0) : b.toFixed(2);
}

export default function FeedPage() {
  const { t, locale, name, variant } = useI18n();
  const { repo, catalog, wilayaCode, wilaya } = useAppData();
  const location = useLocation();
  const cat = catalog.data;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCommune, setSelectedCommune] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'newest' | 'price'>('newest');

  // Data state
  const [items, setItems] = useState<PriceObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);

  // Active detail modal
  const [selectedObservation, setSelectedObservation] = useState<PriceObservation | null>(null);

  // Ratings cache for live voting
  const [ratingsMap, setRatingsMap] = useState<Record<string, ReportRating>>({});

  const getRating = useCallback(
    (obs: PriceObservation): ReportRating => {
      return ratingsMap[obs.id] ?? getReportRating(obs.id, obs.corroborating_reports);
    },
    [ratingsMap],
  );

  const handleVote = useCallback((e: React.MouseEvent, obsId: string, type: 'like' | 'dislike', corroborating = 0) => {
    e.stopPropagation();
    const updated = voteReport(obsId, type, corroborating);
    setRatingsMap((prev) => ({ ...prev, [obsId]: updated }));
  }, []);

  const handleModalVote = useCallback((obsId: string, type: 'like' | 'dislike', corroborating = 0) => {
    const updated = voteReport(obsId, type, corroborating);
    setRatingsMap((prev) => ({ ...prev, [obsId]: updated }));
  }, []);

  // Communes in active wilaya
  const communesInWilaya = useMemo(() => {
    if (!cat) return [];
    return cat.areas.filter((a) => a.wilaya_code === wilayaCode);
  }, [cat, wilayaCode]);

  const loadFeed = useCallback(
    async (reset = false) => {
      if (!cat) return;
      setLoading(true);
      setError(false);
      const nextOffset = reset ? 0 : offset;
      try {
        const res = await repo.listFeed({
          wilayaCode,
          areaId: selectedCommune !== 'all' ? selectedCommune : undefined,
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
          search: searchQuery.trim() || undefined,
          sort: sortKey,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });

        if (reset) {
          setItems(res.items);
          setOffset(PAGE_SIZE);
        } else {
          setItems((prev) => [...prev, ...res.items]);
          setOffset((prev) => prev + PAGE_SIZE);
        }
        setTotal(res.total);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [cat, repo, wilayaCode, selectedCommune, selectedCategory, searchQuery, sortKey, offset],
  );

  useEffect(() => {
    setSelectedCommune('all');
  }, [wilayaCode]);

  // Reload when filters change or returning to feed
  useEffect(() => {
    if (cat) {
      loadFeed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, wilayaCode, selectedCategory, selectedCommune, sortKey, location.key]);

  // Debounced search trigger
  useEffect(() => {
    if (!cat) return;
    const timeout = setTimeout(() => {
      loadFeed(true);
    }, 280);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const productMap = useMemo(() => {
    if (!cat) return new Map<string, Product>();
    return new Map(cat.products.map((p) => [p.id, p]));
  }, [cat]);

  const areaMap = useMemo(() => {
    if (!cat) return new Map<string, string>();
    return new Map(cat.areas.map((a) => [a.id, name(a)]));
  }, [cat, name]);

  if (!cat) {
    return (
      <div className="flex h-full items-center justify-center">
        {catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />}
      </div>
    );
  }

  const selectedProduct = selectedObservation ? productMap.get(selectedObservation.product_id) : null;
  const selectedAreaName = selectedObservation?.area_id ? areaMap.get(selectedObservation.area_id) : null;
  const currentWilayaName = wilaya ? name(wilaya) : '';

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col bg-canvas">
      {/* Sticky Top Header: Search & Filter Toolbar */}
      <div className="shrink-0 border-b border-line bg-surface px-4 py-3 shadow-xs">
        {/* Search input + refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <TextInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('feed.searchPlaceholder')}
              className="ps-9 pe-8 py-2 text-sm rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadFeed(true)}
            disabled={loading}
            aria-label={t('common.retry')}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface text-ink-2 hover:bg-canvas disabled:opacity-50"
          >
            {loading ? <span className="size-4 animate-pulse rounded bg-ink-2/25" /> : <RefreshCw className="size-4" />}
          </button>
        </div>

        {/* Categories Bar */}
        <div className="scrollbar-none -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
              selectedCategory === 'all'
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line-strong bg-surface text-ink-2 hover:bg-canvas'
            }`}
          >
            {t('feed.allCategories')}
          </button>
          {cat.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === c.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line-strong bg-surface text-ink-2 hover:bg-canvas'
              }`}
            >
              {name(c)}
            </button>
          ))}
        </div>

        {/* Secondary filters row: Commune selector & Sorting */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-brand-600" />
            <span className="font-bold text-ink-2 shrink-0 hidden sm:inline truncate max-w-[120px]">
              {currentWilayaName}
            </span>
            <span className="text-muted/60 hidden sm:inline">·</span>
            {communesInWilaya.length > 0 && (
              <div className="min-w-0 flex-1 max-w-[240px]">
                <Select
                  value={selectedCommune}
                  onChange={(e) => setSelectedCommune(e.target.value)}
                  aria-label={t('feed.allAreas')}
                  className="h-8 w-full min-w-0 py-0 ps-2.5 pe-7 text-xs font-semibold rounded-xl border-line bg-surface shadow-2xs hover:bg-canvas transition-colors"
                >
                  <option value="all">{t('feed.allAreas')}</option>
                  {communesInWilaya.map((a) => (
                    <option key={a.id} value={a.id}>
                      {name(a)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <SlidersHorizontal className="size-3.5 text-muted shrink-0 hidden xs:inline" />
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as 'newest' | 'price')}
              aria-label={t('feed.sortNewest')}
              className="h-8 shrink-0 py-0 ps-2.5 pe-7 text-xs font-semibold rounded-xl border-line bg-surface shadow-2xs hover:bg-canvas transition-colors"
            >
              <option value="newest">{t('feed.sortNewest')}</option>
              <option value="price">{t('feed.sortPrice')}</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Vertically Scrollable Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
        {/* Value Proposition Hero Banner */}
        <div className="mb-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-surface p-3.5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                {t('feed.title')} · {currentWilayaName}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{t('app.tagline')}</p>
            </div>
            <Link
              to="/plan"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-700"
            >
              <UtensilsCrossed className="size-3.5" />
              {t('nav.plan')}
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Spinner />
            <p className="text-sm font-medium text-muted">{t('feed.loading')}</p>
          </div>
        )}

        {/* Error State */}
        {error && items.length === 0 && (
          <div className="py-12">
            <ErrorState onRetry={() => loadFeed(true)} />
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong p-8 text-center bg-surface">
            <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Camera className="size-6" />
            </div>
            <div>
              <p className="text-base font-bold text-ink">
                {searchQuery || selectedCategory !== 'all' || selectedCommune !== 'all'
                  ? t('feed.noResults', { area: currentWilayaName })
                  : t('feed.empty')}
              </p>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                {t('feed.subtitle')}
              </p>
            </div>
            <Link
              to="/contribute"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-700"
            >
              <PlusCircle className="size-4" />
              {t('nav.report')}
            </Link>
          </div>
        )}

        {/* List of Price Report Cards */}
        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((obs) => {
              const product = productMap.get(obs.product_id);
              const productName = product ? name(product) : obs.product_id;
              const productVariant = product ? variant(product) : null;
              const rawPrice = formatPriceNumber(obs.price);
              const unitPrice = obs.normalized_price ? formatPriceNumber(obs.normalized_price) : null;
              const unitText = t(`common.perUnit.${obs.comparison_unit}` as MessageKey);
              const qtyText = `${obs.quantity} ${t(`common.unit.${obs.unit}` as MessageKey)}`;
              const dateText = formatDate(obs.observed_on, locale);
              const communeName = obs.area_id ? areaMap.get(obs.area_id) : null;
              const displayLocation = [obs.location_label, communeName].filter(Boolean).join(', ') || currentWilayaName;

              const cardPhoto = obs.photo_url || demoPhotoUrl(obs.product_id, obs.price);

              return (
                <div
                  key={obs.id}
                  onClick={() => setSelectedObservation(obs)}
                  className="group relative flex cursor-pointer flex-col sm:flex-row gap-3.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card hover:border-brand-500 hover:shadow-md transition-all active:scale-[0.995]"
                >
                  {/* Photo / Product visual thumbnail */}
                  <div className="relative aspect-video sm:aspect-square sm:size-28 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                    {cardPhoto ? (
                      <img
                        src={cardPhoto}
                        alt={productName}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-tr from-brand-900 to-brand-600 p-2 text-white text-center">
                        <Camera className="size-8 opacity-60" />
                        <span className="mt-1 text-[11px] font-semibold opacity-80">
                          {t('feed.reportedBy')}
                        </span>
                      </div>
                    )}
                    {obs.is_demo && (
                      <div className="absolute start-2 top-2">
                        <Badge tone="demo">{t('common.demo')}</Badge>
                      </div>
                    )}
                  </div>

                  {/* Information block */}
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Name & price row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-black text-ink leading-tight">
                            {productName}
                          </h2>
                          {productVariant && (
                            <p className="truncate text-xs font-medium text-muted">{productVariant}</p>
                          )}
                        </div>

                        {/* Price callout */}
                        <div className="text-end shrink-0">
                          <span className="num text-xl font-black text-ink">{rawPrice}</span>
                          <span className="ms-1 text-xs font-bold text-muted">DZD</span>
                          <span className="block text-[11px] font-semibold text-muted">
                            ({qtyText})
                          </span>
                        </div>
                      </div>

                      {/* Normalized unit price */}
                      {unitPrice && (
                        <div className="mt-1">
                          <span className="num text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md inline-block">
                            ≈ {unitPrice} DZD {unitText}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Footer: Location & Date */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-xs text-ink-2">
                      <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                        <MapPin className="size-3.5 shrink-0 text-brand-600" />
                        <span className="truncate font-semibold">{displayLocation || currentWilayaName}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted shrink-0">
                        <Clock className="size-3.5" />
                        <span>{dateText}</span>
                      </div>
                    </div>

                    {/* Community Rating & Accuracy row */}
                    {(() => {
                      const rating = getRating(obs);
                      const accuracyPct = getAccuracyPct(rating.likes, rating.dislikes);
                      return (
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/40 pt-2">
                          <div className="flex items-center gap-1.5">
                            {accuracyPct !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  accuracyPct >= 80
                                    ? 'bg-good-bg text-good'
                                    : accuracyPct >= 50
                                    ? 'bg-warn-bg text-warn'
                                    : 'bg-danger-bg text-danger'
                                }`}
                                title={`${rating.likes} accurate, ${rating.dislikes} inaccurate`}
                              >
                                <CheckCircle2 className="size-3" />
                                {accuracyPct}% {t('feed.like')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted font-medium truncate max-w-[130px]">
                                {obs.is_anonymous || !obs.reporter_name
                                  ? t('feed.anonymousReport')
                                  : `@${obs.reporter_name}`}
                              </span>
                            )}
                            <span className="text-[11px] text-muted font-medium">
                              ({rating.likes + rating.dislikes})
                            </span>
                          </div>

                          {/* Interactive Like & Dislike rating buttons */}
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleVote(e, obs.id, 'like', obs.corroborating_reports)}
                              aria-label={t('feed.like')}
                              title={t('feed.like')}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
                                rating.userVote === 'like'
                                  ? 'bg-good-bg text-good border border-good/50 shadow-xs'
                                  : 'bg-surface text-ink-2 hover:bg-canvas border border-line'
                              }`}
                            >
                              <ThumbsUp className={`size-3.5 ${rating.userVote === 'like' ? 'fill-good' : ''}`} />
                              <span className="num">{rating.likes}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleVote(e, obs.id, 'dislike', obs.corroborating_reports)}
                              aria-label={t('feed.dislike')}
                              title={t('feed.dislike')}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
                                rating.userVote === 'dislike'
                                  ? 'bg-danger-bg text-danger border border-danger/50 shadow-xs'
                                  : 'bg-surface text-ink-2 hover:bg-canvas border border-line'
                              }`}
                            >
                              <ThumbsDown className={`size-3.5 ${rating.userVote === 'dislike' ? 'fill-danger' : ''}`} />
                              {rating.dislikes > 0 && <span className="num">{rating.dislikes}</span>}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {items.length > 0 && total !== null && offset < total && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => loadFeed(false)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink-2 shadow-xs hover:bg-canvas disabled:opacity-50"
            >
              {loading ? <Spinner /> : t('common.loadMore')}
            </button>
          </div>
        )}
      </div>

      {/* Full Report Details Modal Dialog */}
      {selectedObservation && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedObservation(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <h3 className="text-base font-extrabold text-ink">
                  {selectedProduct ? name(selectedProduct) : selectedObservation.product_id}
                </h3>
                <p className="text-xs text-muted">
                  {selectedProduct ? variant(selectedProduct) : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedObservation(null)}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
              {/* Photo Evidence if present */}
              {selectedObservation.photo_url || demoPhotoUrl(selectedObservation.product_id, selectedObservation.price) ? (
                <div className="overflow-hidden rounded-2xl border border-line bg-slate-900 max-h-64 aspect-video">
                  <img
                    src={selectedObservation.photo_url || demoPhotoUrl(selectedObservation.product_id, selectedObservation.price)}
                    alt={selectedProduct ? name(selectedProduct) : 'Report photo'}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas p-3 text-xs text-muted">
                  <Camera className="size-4 shrink-0" />
                  <span>Contributor reported this price directly without attaching a photo.</span>
                </div>
              )}

              {/* Price Details Grid */}
              <div className="rounded-2xl border border-line bg-canvas p-4">
                <div className="flex items-baseline justify-between border-b border-line/60 pb-2">
                  <span className="text-xs font-semibold text-muted">{t('compare.reportedPrice')}</span>
                  <span className="num text-2xl font-black text-ink">
                    {formatPriceNumber(selectedObservation.price)} <span className="text-sm font-bold text-muted">DZD</span>
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted block">{t('compare.package')}</span>
                    <span className="num font-bold text-ink">
                      {selectedObservation.quantity} {t(`common.unit.${selectedObservation.unit}` as MessageKey)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block">{t('feed.pricePerUnit')}</span>
                    <span className="num font-bold text-brand-700">
                      {selectedObservation.normalized_price
                        ? `${formatPriceNumber(selectedObservation.normalized_price)} DZD ${t(`common.perUnit.${selectedObservation.comparison_unit}` as MessageKey)}`
                        : t('compare.noUnitPrice')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Community Accuracy Verification Card */}
              {(() => {
                const modalRating = getRating(selectedObservation);
                const modalAccuracy = getAccuracyPct(modalRating.likes, modalRating.dislikes);
                return (
                  <div className="rounded-2xl border border-line bg-canvas p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">
                          {t('feed.communityAccuracy')}
                        </span>
                        {modalAccuracy !== null && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${
                              modalAccuracy >= 80
                                ? 'bg-good-bg text-good'
                                : modalAccuracy >= 50
                                ? 'bg-warn-bg text-warn'
                                : 'bg-danger-bg text-danger'
                            }`}
                          >
                            {modalAccuracy}% {t('feed.like')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-muted">
                        {modalRating.likes + modalRating.dislikes} reviews
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleModalVote(selectedObservation.id, 'like', selectedObservation.corroborating_reports)}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition-all active:scale-98 ${
                          modalRating.userVote === 'like'
                            ? 'bg-good-bg text-good border-2 border-good shadow-xs scale-102'
                            : 'bg-surface text-ink-2 border border-line hover:bg-canvas'
                        }`}
                      >
                        <ThumbsUp className={`size-4 ${modalRating.userVote === 'like' ? 'fill-good' : ''}`} />
                        <span>{t('feed.like')} ({modalRating.likes})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModalVote(selectedObservation.id, 'dislike', selectedObservation.corroborating_reports)}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition-all active:scale-98 ${
                          modalRating.userVote === 'dislike'
                            ? 'bg-danger-bg text-danger border-2 border-danger shadow-xs scale-102'
                            : 'bg-surface text-ink-2 border border-line hover:bg-canvas'
                        }`}
                      >
                        <ThumbsDown className={`size-4 ${modalRating.userVote === 'dislike' ? 'fill-danger' : ''}`} />
                        <span>{t('feed.dislike')} ({modalRating.dislikes})</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Location & When */}
              <div className="space-y-2.5 rounded-2xl border border-line p-4 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 shrink-0 text-brand-600 mt-0.5" />
                  <div>
                    <span className="font-bold text-ink block">{t('feed.where')}</span>
                    <span className="text-ink-2">
                      {[selectedObservation.location_label, selectedAreaName, currentWilayaName].filter(Boolean).join(' · ')}
                    </span>
                    {selectedObservation.lat && selectedObservation.lng && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedObservation.lat},${selectedObservation.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        View map pin
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2 border-t border-line/60 pt-2.5">
                  <Calendar className="size-4 shrink-0 text-muted mt-0.5" />
                  <div>
                    <span className="font-bold text-ink block">{t('feed.when')}</span>
                    <span className="text-ink-2">
                      {formatDate(selectedObservation.observed_on, locale)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 border-t border-line/60 pt-2.5">
                  <User className="size-4 shrink-0 text-muted mt-0.5" />
                  <div>
                    <span className="font-bold text-ink block">{t('contribute.attribution')}</span>
                    <span className="text-ink-2 font-medium">
                      {selectedObservation.is_anonymous || !selectedObservation.reporter_name
                        ? t('feed.anonymousReport')
                        : `@${selectedObservation.reporter_name}`}
                    </span>
                  </div>
                </div>

                {selectedObservation.is_demo && (
                  <div className="flex items-start gap-2 border-t border-line/60 pt-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-demo mt-0.5" />
                    <div>
                      <span className="font-bold text-demo block">{t('common.demoData')}</span>
                      <span className="text-muted text-[11px]">{t('demo.banner')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-line bg-surface p-4 flex flex-wrap gap-2 justify-end">
              <Link
                to="/plan"
                onClick={() => setSelectedObservation(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-4 py-2.5 text-xs font-bold text-ink hover:bg-canvas"
              >
                <UtensilsCrossed className="size-3.5 text-brand-600" />
                {t('feed.addToPlan')}
              </Link>
              <Link
                to={`/contribute?product=${selectedObservation.product_id}`}
                onClick={() => setSelectedObservation(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-700"
              >
                <PlusCircle className="size-3.5" />
                {t('feed.reportAgain')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
