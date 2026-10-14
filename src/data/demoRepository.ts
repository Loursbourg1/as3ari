import { Big } from '../domain/money';
import { todayInAlgeria } from '../domain/dates';
import { normalizeUnitPrice } from '../domain/units';
import { readJson, writeJson } from '../platform/platform';
import type { Catalog, Page, PriceObservation, Product, Shop } from '../domain/types';
import { CATEGORIES, INGREDIENTS, PRODUCTS } from './reference/catalog';
import { RECIPES } from './reference/recipes';
import { LOCAL_AREAS, WILAYAS } from './reference/geography';
import { DEMO_SHOPS, demoObservations } from './demo/fixtures';
import { type AreaCoverage, type ContributionApi, type ObservationQuery, type PriceRepository, type MyReport } from './repository';

/** Simulated latency so loading states are exercised in demo mode too. */
const delay = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export function filterObservations(all: PriceObservation[], shops: Shop[], q: ObservationQuery): Page<PriceObservation> {
  const shopWilaya = new Map(shops.map((s) => [s.id, s.wilaya_code]));
  const items = all
    .filter((o) => (q.wilayaCode === undefined || o.wilaya_code === q.wilayaCode || shopWilaya.get(o.shop_id) === q.wilayaCode))
    .filter((o) => !q.productIds || q.productIds.includes(o.product_id))
    .filter((o) => !q.shopId || o.shop_id === q.shopId)
    .filter((o) => !q.since || o.observed_on >= q.since)
    .filter((o) => !q.minUnitPrice || (o.normalized_price !== null && new Big(o.normalized_price).gte(q.minUnitPrice)))
    .filter((o) => !q.maxUnitPrice || (o.normalized_price !== null && new Big(o.normalized_price).lte(q.maxUnitPrice)))
    .sort((a, b) => (a.observed_on === b.observed_on ? b.submitted_at.localeCompare(a.submitted_at) : b.observed_on.localeCompare(a.observed_on)));
  return { items: items.slice(q.offset, q.offset + q.limit), total: items.length, offset: q.offset, limit: q.limit };
}

const LOCAL_OBS_KEY = 'as3ari.local_observations';
const LOCAL_REPORTS_KEY = 'as3ari.local_reports';

export function createDemoRepository(today = todayInAlgeria()): PriceRepository & {
  contributions: ContributionApi;
} {
  const savedLocalObs = readJson<PriceObservation[]>(LOCAL_OBS_KEY, []);
  const observations = [...savedLocalObs, ...demoObservations(today)];
  const localProducts = readJson<Product[]>('as3ari.local_products', []);
  const allProducts = [...PRODUCTS, ...localProducts];

  const catalog: Catalog = {
    categories: CATEGORIES,
    products: allProducts,
    ingredients: INGREDIENTS,
    recipes: RECIPES,
    wilayas: WILAYAS,
    areas: LOCAL_AREAS,
  };

  const contributions: ContributionApi = {
    available: true,
    async submitReport(input) {
      const prod = allProducts.find((p) => p.id === input.product_id);
      const normalized = prod ? normalizeUnitPrice(input.price, input.quantity, input.unit, prod.dimension) : null;
      const id = 'rep_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6);

      const assignedWilayaCode = input.wilaya_code ?? 17;
      const wilayaRef = WILAYAS.find((w) => w.code === assignedWilayaCode);
      const defaultLat = wilayaRef?.center_lat ?? 34.6704;
      const defaultLng = wilayaRef?.center_lng ?? 3.2503;
      const jitter = ((parseInt(id.slice(-4), 16) % 100) - 50) * 0.0003;

      const newObs: PriceObservation = {
        id,
        product_id: input.product_id,
        shop_id: '',
        price: input.price,
        quantity: input.quantity,
        unit: input.unit,
        normalized_price: normalized?.ok ? normalized.value : input.price,
        comparison_unit: normalized?.ok ? normalized.unit : 'kg',
        observed_on: input.observed_on,
        submitted_at: new Date().toISOString(),
        source: 'community',
        is_demo: false,
        corroborating_reports: 0,
        photo_url: input.photo_url ?? null,
        lat: input.lat ?? Number((defaultLat + jitter).toFixed(6)),
        lng: input.lng ?? Number((defaultLng + jitter * 1.2).toFixed(6)),
        location_label: input.location_label ?? 'Community report',
        wilaya_code: assignedWilayaCode,
        area_id: input.area_id ?? null,
        is_anonymous: input.is_anonymous ?? true,
        reporter_name: input.is_anonymous ? null : (input.reporter_name ?? null),
      };

      observations.unshift(newObs);
      const currentSaved = readJson<PriceObservation[]>(LOCAL_OBS_KEY, []);
      writeJson(LOCAL_OBS_KEY, [newObs, ...currentSaved]);

      const myRep: MyReport = {
        id,
        product_id: newObs.product_id,
        shop_id: '',
        price: newObs.price,
        quantity: newObs.quantity,
        unit: newObs.unit,
        normalized_price: newObs.normalized_price,
        comparison_unit: newObs.comparison_unit,
        observed_on: newObs.observed_on,
        submitted_at: newObs.submitted_at,
        status: 'approved',
        rejection_reason: null,
      };
      const mySaved = readJson<MyReport[]>(LOCAL_REPORTS_KEY, []);
      writeJson(LOCAL_REPORTS_KEY, [myRep, ...mySaved]);

      return delay({
        id,
        status: 'approved',
        normalized_price: newObs.normalized_price ?? input.price,
        comparison_unit: newObs.comparison_unit,
      });
    },
    myReports: (limit, offset) => {
      const saved = readJson<MyReport[]>(LOCAL_REPORTS_KEY, []);
      return delay(saved.slice(offset, offset + limit));
    },
    flagReport: () => delay(undefined),
    isModerator: () => Promise.resolve(true),
    moderationQueue: () => delay([]),
    moderate: () => delay('approved'),
  };

  return {
    mode: 'demo',
    contributions,
    loadCatalog: () => delay(catalog, 60),
    listShops: (wilayaCode) => delay(DEMO_SHOPS.filter((s) => s.wilaya_code === wilayaCode)),
    getShop: (id) => delay(DEMO_SHOPS.find((s) => s.id === id) ?? null),
    listObservations: (q) => delay(filterObservations(observations, DEMO_SHOPS, q)),
    listFeed: (q) => {
      let items = observations;
      if (q.wilayaCode !== undefined) {
        items = items.filter((o) => o.wilaya_code === q.wilayaCode);
      }
      if (q.areaId) {
        items = items.filter((o) => o.area_id === q.areaId);
      }
      if (q.productId) {
        items = items.filter((o) => o.product_id === q.productId);
      }
      if (q.categoryId) {
        const productIds = new Set(catalog.products.filter((p) => p.category_id === q.categoryId).map((p) => p.id));
        items = items.filter((o) => productIds.has(o.product_id));
      }
      if (q.search && q.search.trim()) {
        const s = q.search.trim().toLowerCase();
        const matchingProductIds = new Set(
          catalog.products
            .filter(
              (p) =>
                p.name_en.toLowerCase().includes(s) ||
                p.name_fr.toLowerCase().includes(s) ||
                p.name_ar.toLowerCase().includes(s) ||
                p.search_terms.some((term) => term.toLowerCase().includes(s)),
            )
            .map((p) => p.id),
        );
        items = items.filter(
          (o) => matchingProductIds.has(o.product_id) || (o.location_label && o.location_label.toLowerCase().includes(s)),
        );
      }
      if (q.sort === 'price') {
        items = [...items].sort((a, b) => {
          const pa = new Big(a.normalized_price || 0);
          const pb = new Big(b.normalized_price || 0);
          return pa.cmp(pb);
        });
      } else {
        items = [...items].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
      }
      return delay({
        items: items.slice(q.offset, q.offset + q.limit),
        total: items.length,
        offset: q.offset,
        limit: q.limit,
      });
    },
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

export const unavailableContributionApi = createDemoRepository().contributions;
