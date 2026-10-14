import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Layers,
  PlusCircle,
} from 'lucide-react';
import type { Catalog, PriceObservation, Product } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { formatDate } from '../domain/dates';
import type { MessageKey } from '../i18n/en';
import { Select } from './ui';

interface Props {
  wilayaCode: number;
  wilayaName: string;
  catalog: Catalog;
  observations: PriceObservation[];
  className?: string;
}

interface Point {
  label: string;
  dateKey: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
}

export function PriceTrendChart({
  wilayaCode,
  wilayaName,
  catalog,
  observations,
  className = '',
}: Props) {
  const { t, name, locale } = useI18n();

  // Category filter for the product list
  const [selectedCategory, setSelectedCategory] = useState<string>(catalog.categories[0]?.id ?? 'produce');
  const [selectedProductId, setSelectedProductId] = useState<string>('potatoes');
  const [timeframe, setTimeframe] = useState<'weekly' | 'daily'>('weekly');
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  // All products in catalog plus any dynamically reported products
  const allAvailableProducts = useMemo<Product[]>(() => {
    const list = [...catalog.products];
    const existingIds = new Set(list.map((p) => p.id));
    for (const obs of observations) {
      if (!existingIds.has(obs.product_id)) {
        existingIds.add(obs.product_id);
        list.push({
          id: obs.product_id,
          category_id: 'pantry',
          dimension: 'mass',
          name_en: obs.product_id,
          name_fr: obs.product_id,
          name_ar: obs.product_id,
          variant_en: null,
          variant_fr: null,
          variant_ar: null,
          search_terms: [obs.product_id],
          min_unit_price: '10',
          max_unit_price: '5000',
        });
      }
    }
    return list;
  }, [catalog.products, observations]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    return allAvailableProducts.filter((p) => p.category_id === selectedCategory);
  }, [allAvailableProducts, selectedCategory]);

  // Quick pills based on category selection
  const visiblePills = useMemo(() => {
    return filteredProducts.slice(0, 12);
  }, [filteredProducts]);

  // Ensure selectedProductId is valid when category changes
  const activeProduct = useMemo(() => {
    return (
      allAvailableProducts.find((p) => p.id === selectedProductId) ??
      filteredProducts[0] ??
      allAvailableProducts[0]
    );
  }, [allAvailableProducts, filteredProducts, selectedProductId]);

  // Observations strictly for the selected product
  const productObservations = useMemo(() => {
    if (!activeProduct) return [];
    return observations.filter(
      (o) =>
        o.product_id === activeProduct.id &&
        o.normalized_price !== null &&
        (o.wilaya_code === undefined || o.wilaya_code === wilayaCode || observations.every((item) => item.wilaya_code !== wilayaCode)),
    );
  }, [observations, activeProduct, wilayaCode]);

  // Calculate distinct points for the selected product
  const points = useMemo<Point[]>(() => {
    if (!activeProduct) return [];

    // If actual observations exist for this product, group them
    if (productObservations.length >= 1) {
      if (timeframe === 'weekly') {
        const weekMap = new Map<string, { sum: number; count: number; min: number; max: number; latestDate: string }>();

        for (const o of productObservations) {
          const d = new Date(`${o.observed_on}T00:00:00Z`);
          const oneJan = new Date(d.getFullYear(), 0, 1);
          const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
          const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
          const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

          const price = Number(o.normalized_price);
          const existing = weekMap.get(weekKey);
          if (!existing) {
            weekMap.set(weekKey, { sum: price, count: 1, min: price, max: price, latestDate: o.observed_on });
          } else {
            existing.sum += price;
            existing.count += 1;
            existing.min = Math.min(existing.min, price);
            existing.max = Math.max(existing.max, price);
            if (o.observed_on > existing.latestDate) existing.latestDate = o.observed_on;
          }
        }

        const sortedKeys = Array.from(weekMap.keys()).sort();
        if (sortedKeys.length >= 1) {
          return sortedKeys.slice(-6).map((key, idx) => {
            const g = weekMap.get(key)!;
            const isLatest = idx === sortedKeys.length - 1;
            const avg = Math.round((g.sum / g.count) * 10) / 10;
            return {
              label: isLatest ? 'This Wk' : `W-${sortedKeys.length - 1 - idx}`,
              dateKey: g.latestDate,
              avgPrice: avg,
              minPrice: Math.round(g.min * 10) / 10,
              maxPrice: Math.round(g.max * 10) / 10,
              count: g.count,
            };
          });
        }
      } else {
        // Daily grouping
        const dayMap = new Map<string, { sum: number; count: number; min: number; max: number }>();
        for (const o of productObservations) {
          const price = Number(o.normalized_price);
          const existing = dayMap.get(o.observed_on);
          if (!existing) {
            dayMap.set(o.observed_on, { sum: price, count: 1, min: price, max: price });
          } else {
            existing.sum += price;
            existing.count += 1;
            existing.min = Math.min(existing.min, price);
            existing.max = Math.max(existing.max, price);
          }
        }
        const sortedDates = Array.from(dayMap.keys()).sort().slice(-7);
        if (sortedDates.length >= 1) {
          return sortedDates.map((date) => {
            const g = dayMap.get(date)!;
            return {
              label: formatDate(date, locale).slice(0, 6),
              dateKey: date,
              avgPrice: Math.round((g.sum / g.count) * 10) / 10,
              minPrice: Math.round(g.min * 10) / 10,
              maxPrice: Math.round(g.max * 10) / 10,
              count: g.count,
            };
          });
        }
      }
    }

    // Only realistic data: return empty array when there are no approved observations
    return [];
  }, [activeProduct, productObservations, timeframe, locale]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (points.length === 0) {
      return { current: 0, prev: 0, changePercent: 0, high: 0, low: 0, totalReports: 0 };
    }
    const currentPoint = points[points.length - 1]!;
    const prevPoint = points.length > 1 ? points[points.length - 2] : null;

    const current = currentPoint.avgPrice;
    const prev = prevPoint ? prevPoint.avgPrice : current;
    const diff = current - prev;
    const changePercent = prev > 0 ? Math.round((diff / prev) * 1000) / 10 : 0;

    const allPrices = points.map((p) => p.avgPrice);
    const high = Math.max(...allPrices, ...points.map((p) => p.maxPrice));
    const low = Math.min(...allPrices, ...points.map((p) => p.minPrice));
    const totalReports = points.reduce((acc, p) => acc + p.count, 0);

    return { current, prev, changePercent, high, low, totalReports };
  }, [points]);

  // SVG Geometry
  const svgWidth = 560;
  const svgHeight = 220;
  const paddingX = 45;
  const paddingY = 32;

  const minVal = points.length ? Math.min(...points.map((p) => p.minPrice)) * 0.94 : 0;
  const maxVal = points.length ? Math.max(...points.map((p) => p.maxPrice)) * 1.06 : 100;
  const range = maxVal - minVal || 1;

  const getX = (idx: number) => {
    if (points.length <= 1) return svgWidth / 2;
    return paddingX + (idx / (points.length - 1)) * (svgWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / range;
    return svgHeight - paddingY - ratio * (svgHeight - paddingY * 2);
  };

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.avgPrice).toFixed(1)}`)
      .join(' ');
  }, [points, minVal, range]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(points.length - 1);
    const bottomY = svgHeight - paddingY;
    return `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [linePath, points]);

  const compUnit = activeProduct
    ? activeProduct.dimension === 'mass'
      ? 'kg'
      : activeProduct.dimension === 'volume'
        ? 'l'
        : 'piece'
    : 'kg';
  const unitComparison = t(`common.perUnit.${compUnit}` as MessageKey);

  const isDrop = stats.changePercent < 0;
  const isRise = stats.changePercent > 0;

  return (
    <div className={`rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-xs ${className}`}>
      {/* Top Header: Title & Wilaya Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <TrendingUp className="size-4" />
            </span>
            <h2 className="text-base font-extrabold text-ink">
              {t('trends.title')}
            </h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
              {wilayaName}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {t('trends.subtitle')}
          </p>
        </div>

        {/* Timeframe switch */}
        <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-line bg-canvas p-1 text-xs">
          <button
            type="button"
            onClick={() => setTimeframe('weekly')}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              timeframe === 'weekly' ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t('trends.weekly')}
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('daily')}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              timeframe === 'daily' ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t('trends.daily')}
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted mb-2">
          <Layers className="size-3.5" />
          <span>{t('trends.selectCategory')}</span>
        </div>
        <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCategory(c.id);
                const firstInCat = allAvailableProducts.find((p) => p.category_id === c.id);
                if (firstInCat) setSelectedProductId(firstInCat.id);
              }}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === c.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-canvas text-ink-2 hover:bg-surface'
              }`}
            >
              {name(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Product Selector Dropdown & Quick Selection */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto sm:min-w-[240px]">
          <Select
            value={activeProduct ? activeProduct.id : selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              setHoveredPoint(null);
            }}
            className="h-10 text-xs font-bold rounded-xl"
            aria-label={t('trends.selectProduct')}
          >
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {name(p)}
              </option>
            ))}
          </Select>
        </div>

        {/* Quick popular staples shortcuts or category items */}
        <div className="flex flex-wrap gap-1.5">
          {visiblePills.map((p) => {
            const isSelected = activeProduct?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProductId(p.id);
                  setHoveredPoint(null);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                {name(p)}
              </button>
            );
          })}
        </div>
      </div>



      {/* Market Statistics Cards */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Latest Average Price */}
        <div className="rounded-xl bg-canvas p-3 border border-line">
          <span className="text-[11px] font-semibold text-muted block">{t('trends.currentAvg')}</span>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="num text-2xl font-black text-ink">{stats.current}</span>
            <span className="text-xs font-bold text-muted">DZD{unitComparison}</span>
          </div>
        </div>

        {/* Weekly Fluctuation Rate */}
        <div className="rounded-xl bg-canvas p-3 border border-line">
          <span className="text-[11px] font-semibold text-muted block">{t('trends.fluctuation')}</span>
          <div className="mt-1 flex items-center gap-1.5">
            {isDrop && (
              <span className="inline-flex items-center gap-1 rounded-md bg-good-bg px-2 py-0.5 text-xs font-extrabold text-good">
                <TrendingDown className="size-3.5" />
                {stats.changePercent}%
              </span>
            )}
            {isRise && (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-bg px-2 py-0.5 text-xs font-extrabold text-danger">
                <TrendingUp className="size-3.5" />
                +{stats.changePercent}%
              </span>
            )}
            {!isDrop && !isRise && (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-muted border border-line">
                <Minus className="size-3.5" />
                {t('trends.stable')}
              </span>
            )}
            <span className="text-[10px] text-muted hidden sm:inline">
              {isDrop ? `(${t('trends.cheaper')})` : isRise ? `(${t('trends.higher')})` : ''}
            </span>
          </div>
        </div>

        {/* Range High / Low */}
        <div className="rounded-xl bg-canvas p-3 border border-line">
          <span className="text-[11px] font-semibold text-muted block">{t('trends.range')}</span>
          <div className="mt-1 text-xs font-bold text-ink">
            <span className="num text-good">{stats.low}</span>
            <span className="text-muted mx-1">/</span>
            <span className="num text-warn">{stats.high}</span>
            <span className="text-[11px] font-normal text-muted ms-1">DZD</span>
          </div>
        </div>

        {/* Verified Reports Count */}
        <div className="rounded-xl bg-canvas p-3 border border-line">
          <span className="text-[11px] font-semibold text-muted block">{t('trends.reportsCount')}</span>
          <div className="mt-1 text-xs font-extrabold text-brand-700 flex items-center gap-1">
            <span className="num text-base">{stats.totalReports}</span>
            <span className="font-semibold text-muted text-[11px]">{t('trends.reportsUnit')}</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Light Fluctuation Chart or Clean No-Data Empty State */}
      {points.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/70 px-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <TrendingUp className="size-6 opacity-60" />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">
            {t('trends.noData', { area: wilayaName })}
          </p>
          <p className="mt-1 text-xs text-muted max-w-sm">
            {t('trends.note', { area: wilayaName })}
          </p>
          <Link
            to={`/contribute?product=${activeProduct?.id ?? ''}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-700 transition-colors"
          >
            <PlusCircle className="size-4" />
            <span>{t('trends.noDataAction')}</span>
          </Link>
        </div>
      ) : (
        <div className="relative mt-4 rounded-xl border border-line bg-canvas p-3 pt-5 text-ink overflow-hidden">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-44 sm:h-52 overflow-visible select-none"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d978e" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0d978e" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal grid guidelines */}
            {[0.2, 0.5, 0.8].map((level) => {
              const y = paddingY + level * (svgHeight - paddingY * 2);
              const val = Math.round(maxVal - level * range);
              return (
                <g key={level}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={svgWidth - paddingX}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#94a3b8"
                    className="font-mono font-medium"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area gradient under the line */}
            {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

            {/* Clean brand teal line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#0d978e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Points */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const cy = getY(p.avgPrice);
              const isHovered = hoveredPoint?.dateKey === p.dateKey;
              return (
                <g
                  key={p.dateKey + idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onClick={() => setHoveredPoint(p)}
                >
                  {/* Active circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill="#ffffff"
                    stroke="#0d978e"
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all"
                  />

                  {/* X axis labels */}
                  <text
                    x={cx}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                    fontWeight="600"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover / Touch Tooltip Card */}
          {hoveredPoint && (
            <div className="absolute top-3 end-3 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card backdrop-blur animate-in fade-in">
              <div className="flex items-center justify-between gap-3 text-ink-2">
                <span className="font-bold text-ink">{hoveredPoint.label}</span>
                <span className="text-[10px] text-muted">
                  {formatDate(hoveredPoint.dateKey, locale)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="num text-base font-black text-brand-700">
                  {hoveredPoint.avgPrice} DZD
                </span>
                <span className="text-[10px] text-muted">{unitComparison}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                {hoveredPoint.minPrice} - {hoveredPoint.maxPrice} DZD · {hoveredPoint.count} {t('trends.reportsUnit')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Context note */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-canvas p-3 text-xs text-muted border border-line">
        <Info className="size-4 shrink-0 text-brand-600 mt-0.5" />
        <p>
          {t('trends.note', { area: wilayaName })}
        </p>
      </div>
    </div>
  );
}
