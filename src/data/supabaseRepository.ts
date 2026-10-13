import type { SupabaseClient } from '@supabase/supabase-js';
import { toReportErrorCode, priceReportInput, flagInput } from '../domain/reportSchema';
import type {
  Catalog,
  Category,
  ComparisonUnit,
  Ingredient,
  LocalArea,
  Page,
  PriceObservation,
  Product,
  Recipe,
  ReportStatus,
  Shop,
  Wilaya,
} from '../domain/types';
import { ApiError, type AreaCoverage, type ContributionApi, type MyReport, type ObservationQuery, type PriceRepository, type QueueItem } from './repository';
import { CATEGORIES, INGREDIENTS, PRODUCTS } from './reference/catalog';
import { RECIPES } from './reference/recipes';
import { LOCAL_AREAS, WILAYAS } from './reference/geography';
import { DEMO_SHOPS, demoObservations } from './demo/fixtures';
import { todayInAlgeria } from '../domain/dates';
import { readJson } from '../platform/platform';

const dec = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const decOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function fail(error: { message?: string } | null): never {
  // Never surface raw database messages to the UI — map to known codes only.
  throw new ApiError(toReportErrorCode(error?.message));
}

/** Fetch all rows of a small reference table, page by page. */
async function fetchAll<T>(client: SupabaseClient, table: string, select = '*', order = 'id'): Promise<T[]> {
  const out: T[] = [];
  const size = 500;
  for (let from = 0; from < 10_000; from += size) {
    const { data, error } = await client.from(table).select(select).order(order).range(from, from + size - 1);
    if (error) fail(error);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

function mapShop(r: Record<string, unknown>): Shop {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as Shop['kind'],
    wilaya_code: Number(r.wilaya_code),
    area_id: (r.area_id as string | null) ?? null,
    address_text: (r.address_text as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    provenance: r.provenance as Shop['provenance'],
    is_demo: Boolean(r.is_demo),
  };
}

function mapObservation(r: Record<string, unknown>): PriceObservation {
  return {
    id: String(r.id),
    product_id: String(r.product_id),
    shop_id: String(r.shop_id ?? ''),
    price: dec(r.price),
    quantity: dec(r.quantity),
    unit: r.unit as PriceObservation['unit'],
    normalized_price: decOrNull(r.normalized_price),
    comparison_unit: r.comparison_unit as ComparisonUnit,
    observed_on: String(r.observed_on),
    submitted_at: String(r.submitted_at),
    source: r.source as PriceObservation['source'],
    is_demo: Boolean(r.is_demo),
    corroborating_reports: Number(r.corroborating_reports ?? 0),
    photo_url: (r.photo_url as string | null) ?? null,
    lat: r.lat !== null && r.lat !== undefined ? Number(r.lat) : null,
    lng: r.lng !== null && r.lng !== undefined ? Number(r.lng) : null,
    location_label: (r.location_label as string | null) ?? (r.shop_name as string | null) ?? null,
    wilaya_code: r.wilaya_code !== null && r.wilaya_code !== undefined ? Number(r.wilaya_code) : null,
    is_anonymous: r.is_anonymous !== undefined ? Boolean(r.is_anonymous) : true,
    reporter_name: (r.reporter_name as string | null) ?? null,
  };
}

const SHOP_COLUMNS = 'id,name,kind,wilaya_code,area_id,address_text,lat,lng,provenance,is_demo';

export function createSupabaseRepository(client: SupabaseClient, opts: { showDemoData: boolean }): PriceRepository {
  return {
    mode: 'live',
    async loadCatalog(): Promise<Catalog> {
      // Attempt to load from Supabase; fall back to bundled reference data if empty/failing
      try {
        const [categories, products, ingredients, recipes, recipeIngredients, wilayas, areas] = await Promise.all([
          fetchAll<Category>(client, 'categories', '*', 'sort_order'),
          fetchAll<Record<string, unknown>>(client, 'products'),
          fetchAll<Ingredient>(client, 'ingredients'),
          fetchAll<Record<string, unknown>>(client, 'recipes'),
          fetchAll<Record<string, unknown>>(client, 'recipe_ingredients', '*', 'recipe_id'),
          fetchAll<Record<string, unknown>>(client, 'wilayas', '*', 'code'),
          fetchAll<LocalArea>(client, 'local_areas'),
        ]);
        const localProducts = readJson<Product[]>('as3ari.local_products', []);
        // If Supabase database is unseeded, fall back to bundled fixtures so the app always works
        if (categories.length === 0 || products.length === 0) {
          return {
            categories: CATEGORIES,
            products: [...PRODUCTS, ...localProducts],
            ingredients: INGREDIENTS,
            recipes: RECIPES,
            wilayas: WILAYAS,
            areas: LOCAL_AREAS,
          };
        }
        const mappedProducts = products.map((p) => ({ ...(p as unknown as Product), min_unit_price: dec(p.min_unit_price), max_unit_price: dec(p.max_unit_price) }));
        return {
          categories: categories.map((c) => ({ ...c, recent_days: Number(c.recent_days), stale_days: Number(c.stale_days) })),
          products: [...mappedProducts, ...localProducts],
          ingredients,
          recipes: recipes.map((r) => ({
            ...(r as unknown as Recipe),
            ingredients: recipeIngredients
              .filter((ri) => ri.recipe_id === r.id)
              .map((ri) => ({ ingredient_id: String(ri.ingredient_id), quantity: dec(ri.quantity), unit: ri.unit as Recipe['ingredients'][number]['unit'] })),
          })),
          wilayas: wilayas.map((w) => ({
            ...(w as unknown as Wilaya),
            center_lat: w.center_lat === null ? null : Number(w.center_lat),
            center_lng: w.center_lng === null ? null : Number(w.center_lng),
          })),
          areas,
        };
      } catch {
        const localProducts = readJson<Product[]>('as3ari.local_products', []);
        // Network error or RLS blocking — return bundled reference data so app is always usable
        return {
          categories: CATEGORIES,
          products: [...PRODUCTS, ...localProducts],
          ingredients: INGREDIENTS,
          recipes: RECIPES,
          wilayas: WILAYAS,
          areas: LOCAL_AREAS,
        };
      }
    },

    async listShops(wilayaCode) {
      let q = client.from('shops').select(SHOP_COLUMNS).eq('wilaya_code', wilayaCode).eq('is_active', true).order('name').limit(1000);
      if (!opts.showDemoData) q = q.eq('is_demo', false);
      const { data, error } = await q;
      if (error) {
        // Fall back to bundled demo shops if Supabase fails
        return DEMO_SHOPS.filter((s) => s.wilaya_code === wilayaCode);
      }
      // If Supabase has no shops for this wilaya yet, use demo shops as fallback
      if (!data || data.length === 0) {
        return DEMO_SHOPS.filter((s) => s.wilaya_code === wilayaCode);
      }
      return data.map(mapShop);
    },

    async getShop(id) {
      const { data, error } = await client.from('shops').select(SHOP_COLUMNS).eq('id', id).maybeSingle();
      if (error) fail(error);
      return data ? mapShop(data) : null;
    },

    async listObservations(qp: ObservationQuery): Promise<Page<PriceObservation>> {
      let q = client
        .from('public_price_observations')
        .select('*', { count: 'exact' })
        .order('observed_on', { ascending: false })
        .order('submitted_at', { ascending: false })
        .range(qp.offset, qp.offset + qp.limit - 1);
      if (qp.wilayaCode !== undefined) q = q.eq('wilaya_code', qp.wilayaCode);
      if (qp.productIds) q = q.in('product_id', qp.productIds);
      if (qp.shopId) q = q.eq('shop_id', qp.shopId);
      if (qp.since) q = q.gte('observed_on', qp.since);
      if (qp.minUnitPrice) q = q.gte('normalized_price', qp.minUnitPrice);
      if (qp.maxUnitPrice) q = q.lte('normalized_price', qp.maxUnitPrice);
      if (!opts.showDemoData) q = q.eq('is_demo', false);
      const { data, error, count } = await q;
      if (error) fail(error);
      return { items: (data ?? []).map(mapObservation), total: count ?? null, offset: qp.offset, limit: qp.limit };
    },

    async listFeed(q): Promise<Page<PriceObservation>> {
      const buildQuery = (wilaya?: number) => {
        let query = client.from('public_price_observations').select('*', { count: 'exact' });
        if (wilaya !== undefined) query = query.eq('wilaya_code', wilaya);
        if (q.areaId) query = query.eq('area_id', q.areaId);
        if (q.productId) query = query.eq('product_id', q.productId);
        if (!opts.showDemoData) query = query.eq('is_demo', false);

        if (q.sort === 'price') {
          query = query.order('normalized_price', { ascending: true });
        } else {
          query = query.order('observed_on', { ascending: false }).order('submitted_at', { ascending: false });
        }
        return query.range(q.offset, q.offset + q.limit - 1);
      };

      try {
        const { data, error, count } = await buildQuery(q.wilayaCode);
        if (error) throw error;

        // If a specific wilaya has no records yet and showDemoData is on, fall back to nationwide
        if ((!data || data.length === 0) && q.wilayaCode !== undefined && opts.showDemoData) {
          const fallback = await buildQuery(undefined);
          if (!fallback.error && fallback.data && fallback.data.length > 0) {
            return { items: fallback.data.map(mapObservation), total: fallback.count ?? null, offset: q.offset, limit: q.limit };
          }
        }

        // If still empty and showDemoData is on, inject bundled demo observations
        if ((!data || data.length === 0) && opts.showDemoData && q.offset === 0) {
          const today = todayInAlgeria();
          const demos = demoObservations(today);
          const filtered = q.wilayaCode !== undefined
            ? demos.filter((o) => o.wilaya_code === q.wilayaCode)
            : demos;
          const slice = (filtered.length > 0 ? filtered : demos).slice(0, q.limit);
          return { items: slice, total: slice.length, offset: 0, limit: q.limit };
        }

        return { items: (data ?? []).map(mapObservation), total: count ?? null, offset: q.offset, limit: q.limit };
      } catch {
        // Network failure — return demo data as fallback so feed is never empty
        if (opts.showDemoData && q.offset === 0) {
          const today = todayInAlgeria();
          const demos = demoObservations(today);
          const filtered = q.wilayaCode !== undefined ? demos.filter((o) => o.wilaya_code === q.wilayaCode) : demos;
          const slice = (filtered.length > 0 ? filtered : demos).slice(0, q.limit);
          return { items: slice, total: slice.length, offset: 0, limit: q.limit };
        }
        return { items: [], total: 0, offset: q.offset, limit: q.limit };
      }
    },

    async areaCoverage(wilayaCode): Promise<AreaCoverage> {
      const { data, error } = await client.rpc('area_coverage', { p_wilaya: wilayaCode });
      if (error) fail(error);
      const r = (Array.isArray(data) ? data[0] : data) ?? {};
      return {
        shopCount: Number(r.shop_count ?? 0),
        demoShopCount: Number(r.demo_shop_count ?? 0),
        shopsWithReports: Number(r.shops_with_reports ?? 0),
        approvedReports: Number(r.approved_reports ?? 0),
        demoReports: Number(r.demo_reports ?? 0),
        lastObservedOn: r.last_observed_on ?? null,
      };
    },
  };
}

function mapMyReport(r: Record<string, unknown>): MyReport {
  return {
    id: String(r.id),
    product_id: String(r.product_id),
    shop_id: String(r.shop_id),
    price: dec(r.price),
    quantity: dec(r.quantity),
    unit: r.unit as MyReport['unit'],
    normalized_price: decOrNull(r.normalized_price),
    comparison_unit: r.comparison_unit as ComparisonUnit,
    observed_on: String(r.observed_on),
    submitted_at: String(r.submitted_at),
    status: r.status as ReportStatus,
    rejection_reason: (r.rejection_reason as string | null) ?? null,
  };
}

export function createSupabaseContributionApi(client: SupabaseClient, opts: { submitVia: 'edge' | 'rpc' }): ContributionApi {
  return {
    available: true,
    async submitReport(input) {
      const parsed = priceReportInput.safeParse(input);
      if (!parsed.success) throw new ApiError('invalid_input');
      const v = parsed.data;
      if (opts.submitVia === 'edge') {
        const { data, error } = await client.functions.invoke('submit-report', { body: v });
        if (error) {
          let code = 'server_error';
          try {
            const body = await (error as { context?: Response }).context?.json();
            code = toReportErrorCode(body?.error);
          } catch {
            /* keep generic code */
          }
          throw new ApiError(code);
        }
        return data as { id: string; status: ReportStatus; normalized_price: string; comparison_unit: ComparisonUnit };
      }
      if (!v.shop_id && v.location_label) {
        const { data, error } = await client.rpc('submit_report_with_location', {
          p_product_id: v.product_id,
          p_price: v.price,
          p_quantity: v.quantity,
          p_unit: v.unit,
          p_observed_on: v.observed_on,
          p_location_label: v.location_label,
          p_lat: v.lat ?? null,
          p_lng: v.lng ?? null,
          p_photo_url: v.photo_url ?? null,
          p_is_anonymous: v.is_anonymous ?? true,
          p_reporter_name: v.is_anonymous ? null : (v.reporter_name ?? null),
        });
        if (error) fail(error);
        const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
        return { id: String(row.id), status: row.status as ReportStatus, normalized_price: dec(row.normalized_price), comparison_unit: row.comparison_unit as ComparisonUnit };
      }
      const { data, error } = await client.rpc('submit_price_report', {
        p_product_id: v.product_id,
        p_shop_id: v.shop_id,
        p_price: v.price,
        p_quantity: v.quantity,
        p_unit: v.unit,
        p_observed_on: v.observed_on,
        p_is_anonymous: v.is_anonymous ?? true,
        p_reporter_name: v.is_anonymous ? null : (v.reporter_name ?? null),
      });
      if (error) fail(error);
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
      return { id: String(row.id), status: row.status as ReportStatus, normalized_price: dec(row.normalized_price), comparison_unit: row.comparison_unit as ComparisonUnit };
    },
    async myReports(limit, offset) {
      const { data, error } = await client.rpc('my_price_reports', { p_limit: limit, p_offset: offset });
      if (error) fail(error);
      return ((data ?? []) as Record<string, unknown>[]).map(mapMyReport);
    },
    async flagReport(input) {
      const parsed = flagInput.safeParse(input);
      if (!parsed.success) throw new ApiError('invalid_input');
      const { error } = await client.rpc('flag_price_report', {
        p_report_id: parsed.data.report_id,
        p_reason: parsed.data.reason,
        p_note: parsed.data.note ?? null,
      });
      if (error) fail(error);
    },
    async isModerator() {
      const { data, error } = await client.rpc('is_moderator');
      if (error) return false;
      return data === true;
    },
    async moderationQueue(status, flaggedOnly) {
      const { data, error } = await client.rpc('moderation_queue', { p_status: status, p_flagged_only: flaggedOnly, p_limit: 100, p_offset: 0 });
      if (error) fail(error);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...mapMyReport({ ...r, rejection_reason: null }),
        shop_name: String(r.shop_name),
        contributor_id: (r.contributor_id as string | null) ?? null,
        open_flags: Number(r.open_flags ?? 0),
        contributor_report_count: Number(r.contributor_report_count ?? 0),
      })) as QueueItem[];
    },
    async moderate(reportId, decision, note) {
      const { data, error } = await client.rpc('moderate_price_report', { p_report_id: reportId, p_decision: decision, p_note: note ?? null });
      if (error) fail(error);
      return data as ReportStatus;
    },
  };
}
