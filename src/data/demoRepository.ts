import { Big } from '../domain/money';
import { todayInAlgeria } from '../domain/dates';
import type { Catalog, Page, PriceObservation, Shop } from '../domain/types';
import { CATEGORIES, INGREDIENTS, PRODUCTS } from './reference/catalog';
import { RECIPES } from './reference/recipes';
import { LOCAL_AREAS, WILAYAS } from './reference/geography';
import { DEMO_SHOPS, demoObservations } from './demo/fixtures';
import { ApiError, type AreaCoverage, type ContributionApi, type ObservationQuery, type PriceRepository } from './repository';

/** Simulated latency so loading states are exercised in demo mode too. */
const delay = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export function filterObservations(all: PriceObservation[], shops: Shop[], q: ObservationQuery): Page<PriceObservation> {
  const shopWilaya = new Map(shops.map((s) => [s.id, s.wilaya_code]));
  const items = all
    .filter((o) => (q.wilayaCode === undefined || shopWilaya.get(o.shop_id) === q.wilayaCode))
    .filter((o) => !q.productIds || q.productIds.includes(o.product_id))
    .filter((o) => !q.shopId || o.shop_id === q.shopId)
    .filter((o) => !q.since || o.observed_on >= q.since)
    .filter((o) => !q.minUnitPrice || (o.normalized_price !== null && new Big(o.normalized_price).gte(q.minUnitPrice)))
    .filter((o) => !q.maxUnitPrice || (o.normalized_price !== null && new Big(o.normalized_price).lte(q.maxUnitPrice)))
    .sort((a, b) => (a.observed_on === b.observed_on ? b.submitted_at.localeCompare(a.submitted_at) : b.observed_on.localeCompare(a.observed_on)));
  return { items: items.slice(q.offset, q.offset + q.limit), total: items.length, offset: q.offset, limit: q.limit };
}

export function createDemoRepository(today = todayInAlgeria()): PriceRepository {
  const observations = demoObservations(today);
  const catalog: Catalog = {
    categories: CATEGORIES,
    products: PRODUCTS,
    ingredients: INGREDIENTS,
    recipes: RECIPES,
    wilayas: WILAYAS,
    areas: LOCAL_AREAS,
  };
  return {
    mode: 'demo',
    loadCatalog: () => delay(catalog, 60),
    listShops: (wilayaCode) => delay(DEMO_SHOPS.filter((s) => s.wilaya_code === wilayaCode)),
    getShop: (id) => delay(DEMO_SHOPS.find((s) => s.id === id) ?? null),
    listObservations: (q) => delay(filterObservations(observations, DEMO_SHOPS, q)),
    areaCoverage: (wilayaCode): Promise<AreaCoverage> => {
      const shops = DEMO_SHOPS.filter((s) => s.wilaya_code === wilayaCode);
      const obs = observations.filter((o) => shops.some((s) => s.id === o.shop_id));
      return delay({
        shopCount: 0,
        demoShopCount: shops.length,
        shopsWithReports: 0,
        approvedReports: 0,
        demoReports: obs.length,
        lastObservedOn: obs.reduce<string | null>((m, o) => (m === null || o.observed_on > m ? o.observed_on : m), null),
      });
    },
  };
}

/** In demo mode there is no backend: contributions are unavailable, never simulated. */
export const unavailableContributionApi: ContributionApi = {
  available: false,
  submitReport: () => Promise.reject(new ApiError('accounts_unavailable')),
  myReports: () => Promise.reject(new ApiError('accounts_unavailable')),
  flagReport: () => Promise.reject(new ApiError('accounts_unavailable')),
  isModerator: () => Promise.resolve(false),
  moderationQueue: () => Promise.reject(new ApiError('accounts_unavailable')),
  moderate: () => Promise.reject(new ApiError('accounts_unavailable')),
};
