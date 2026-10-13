import { describe, expect, it } from 'vitest';
import { buildComparison, coverageLevel, latestPerShop, medianPrice } from './comparison';
import { freshnessOf } from './freshness';
import { addDays, daysBetween, isIsoDate, todayInAlgeria } from './dates';
import { searchProducts, normalizeText } from './search';
import type { PriceObservation, Shop } from './types';
import { CATEGORIES, PRODUCTS } from '../data/reference/catalog';

const TODAY = '2026-10-11';
const potatoes = PRODUCTS.find((p) => p.id === 'potatoes')!;

function shop(id: string, lat = 34.67, lng = 3.25): Shop {
  return { id, name: `Shop ${id}`, kind: 'shop', wilaya_code: 17, area_id: null, address_text: null, lat, lng, provenance: 'verified_visit', is_demo: false };
}
function obs(id: string, shopId: string, price: string, daysAgo: number, extra: Partial<PriceObservation> = {}): PriceObservation {
  const d = addDays(TODAY, -daysAgo);
  return {
    id, product_id: 'potatoes', shop_id: shopId, price, quantity: '1', unit: 'kg', normalized_price: price,
    comparison_unit: 'kg', observed_on: d, submitted_at: `${d}T10:00:00Z`, source: 'community', is_demo: false,
    corroborating_reports: 0, ...extra,
  };
}

describe('freshness', () => {
  const t = { recent_days: 7, stale_days: 21 };
  it('classifies by age using category thresholds', () => {
    expect(freshnessOf(TODAY, TODAY, t)).toEqual({ state: 'recent', ageDays: 0 });
    expect(freshnessOf(addDays(TODAY, -7), TODAY, t).state).toBe('recent');
    expect(freshnessOf(addDays(TODAY, -8), TODAY, t).state).toBe('aging');
    expect(freshnessOf(addDays(TODAY, -21), TODAY, t).state).toBe('aging');
    expect(freshnessOf(addDays(TODAY, -22), TODAY, t).state).toBe('stale');
  });
  it('never yields negative ages for future-dated data', () => {
    expect(freshnessOf(addDays(TODAY, 2), TODAY, t).ageDays).toBe(0);
  });
  it('date helpers are calendar-exact', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-10-11')).toBe(true);
    expect(todayInAlgeria(new Date('2026-10-10T23:30:00Z'))).toBe('2026-10-11');
  });
});

describe('buildComparison', () => {
  const shops = [shop('a'), shop('b', 34.68, 3.26), shop('c', 34.6, 3.2)];

  it('uses only the latest observation per shop but keeps history counts', () => {
    const r = buildComparison({
      product: potatoes, shops, categories: CATEGORIES, today: TODAY,
      observations: [obs('1', 'a', '100.00', 1), obs('2', 'a', '80.00', 10), obs('3', 'b', '95.00', 2)],
    });
    const a = r.rows.find((x) => x.shop.id === 'a')!;
    expect(a.observation.id).toBe('1');
    expect(a.historyCount).toBe(2);
  });

  it('marks the lowest reported price only among current observations from 2+ shops', () => {
    const r = buildComparison({
      product: potatoes, shops, categories: CATEGORIES, today: TODAY,
      observations: [obs('1', 'a', '100.00', 1), obs('2', 'b', '95.00', 2), obs('3', 'c', '50.00', 60)],
    });
    expect(r.rows.map((x) => x.shop.id)).toEqual(['b', 'a', 'c']); // stale sinks to the bottom
    expect(r.rows.find((x) => x.shop.id === 'b')!.isLowestReported).toBe(true);
    expect(r.rows.find((x) => x.shop.id === 'c')!.isLowestReported).toBe(false);
    expect(r.coverage).toBe('limited');
    expect(r.staleShopCount).toBe(1);
  });

  it('does not label a lowest price when only one shop has current data', () => {
    const r = buildComparison({ product: potatoes, shops, categories: CATEGORIES, today: TODAY, observations: [obs('1', 'a', '100.00', 1)] });
    expect(r.rows[0]!.isLowestReported).toBe(false);
    expect(r.coverage).toBe('insufficient');
  });

  it('excludes observations with another comparison unit or product', () => {
    const r = buildComparison({
      product: potatoes, shops, categories: CATEGORIES, today: TODAY,
      observations: [obs('1', 'a', '100.00', 1), obs('2', 'b', '10.00', 1, { comparison_unit: 'piece' }), obs('3', 'c', '5.00', 1, { product_id: 'onions' })],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by freshness and by distance when an origin is given', () => {
    const observations = [obs('1', 'a', '100.00', 3), obs('2', 'b', '95.00', 1), obs('3', 'c', '90.00', 2)];
    const byFresh = buildComparison({ product: potatoes, shops, categories: CATEGORIES, today: TODAY, observations, sort: 'freshness' });
    expect(byFresh.rows.map((x) => x.shop.id)).toEqual(['b', 'c', 'a']);
    const byDist = buildComparison({ product: potatoes, shops, categories: CATEGORIES, today: TODAY, observations, sort: 'distance', origin: { lat: 34.6, lng: 3.2 } });
    expect(byDist.rows[0]!.shop.id).toBe('c');
    expect(byDist.rows[0]!.distanceKm).toBeCloseTo(0, 3);
  });

  it('falls back to price sort when distance is requested without an origin', () => {
    const observations = [obs('1', 'a', '100.00', 3), obs('2', 'b', '95.00', 1)];
    const r = buildComparison({ product: potatoes, shops, categories: CATEGORIES, today: TODAY, observations, sort: 'distance' });
    expect(r.rows[0]!.shop.id).toBe('b');
    expect(r.rows[0]!.distanceKm).toBeNull();
  });

  it('ignores observations for unknown shops', () => {
    const r = buildComparison({ product: potatoes, shops, categories: CATEGORIES, today: TODAY, observations: [obs('1', 'zzz', '1.00', 1)] });
    expect(r.rows).toHaveLength(0);
    expect(r.coverage).toBe('none');
  });

  it('coverage levels', () => {
    expect(coverageLevel(0, 0)).toBe('none');
    expect(coverageLevel(0, 2)).toBe('stale_only');
    expect(coverageLevel(1, 0)).toBe('insufficient');
    expect(coverageLevel(4, 0)).toBe('limited');
    expect(coverageLevel(5, 0)).toBe('adequate');
  });

  it('median and latest helpers', () => {
    expect(medianPrice([])).toBeNull();
    expect(medianPrice(['10.00', '30.00', '20.00'])).toBe('20.00');
    expect(medianPrice(['10.00', '15.00'])).toBe('12.50');
    expect(latestPerShop([obs('1', 'a', '1', 5), obs('2', 'a', '2', 1)]).get('a')!.latest.id).toBe('2');
  });
});

describe('search', () => {
  it('normalizes case, accents, Arabic variants and whitespace', () => {
    expect(normalizeText('  Pommes   de TERRE ')).toBe('pommes de terre');
    expect(normalizeText('Œufs')).toBe('œufs');
    expect(normalizeText('Crème')).toBe('creme');
    expect(normalizeText('أرز')).toBe(normalizeText('ارز'));
  });
  it('finds products by English, French, Arabic name and synonyms', () => {
    expect(searchProducts(PRODUCTS, CATEGORIES, 'potatoes')[0]!.product.id).toBe('potatoes');
    expect(searchProducts(PRODUCTS, CATEGORIES, 'pomme')[0]!.product.id).toBe('potatoes');
    expect(searchProducts(PRODUCTS, CATEGORIES, 'بطاطا')[0]!.product.id).toBe('potatoes');
    expect(searchProducts(PRODUCTS, CATEGORIES, 'EGGS')[0]!.product.id).toBe('eggs');
    expect(searchProducts(PRODUCTS, CATEGORIES, 'pasta')[0]!.product.id).toBe('spaghetti');
  });
  it('tolerates a single typo', () => {
    expect(searchProducts(PRODUCTS, CATEGORIES, 'potatos')[0]!.product.id).toBe('potatoes');
  });
  it('returns variants as separate products', () => {
    const ids = searchProducts(PRODUCTS, CATEGORIES, 'milk').map((m) => m.product.id);
    expect(ids).toEqual(expect.arrayContaining(['milk-uht', 'milk-pasteurised-bag']));
  });
  it('matches by category with lower priority', () => {
    const r = searchProducts(PRODUCTS, CATEGORIES, 'vegetables', 50);
    expect(r.length).toBeGreaterThan(3);
  });
  it('returns nothing for empty or unmatched queries', () => {
    expect(searchProducts(PRODUCTS, CATEGORIES, '   ')).toEqual([]);
    expect(searchProducts(PRODUCTS, CATEGORIES, 'qwertyzz')).toEqual([]);
  });
});
