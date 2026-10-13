/**
 * SYNTHETIC DEMONSTRATION DATA — NOT REAL SHOPS, NOT REAL PRICES.
 *
 * These fixtures exist only so the interface can be demonstrated before genuine
 * observations are collected. Every shop has provenance "demo", every observation
 * has source "demo", and the UI labels them as demo data everywhere they appear.
 * They are never counted as community contributions.
 */
import { normalizeUnitPrice } from '../../domain/units';
import { roundMoney, Big } from '../../domain/money';
import { addDays } from '../../domain/dates';
import type { PriceObservation, Shop, ShopKind, UnitCode } from '../../domain/types';
import { PRODUCTS } from '../reference/catalog';

const DEMO_CENTER = { lat: 34.6704, lng: 3.2503 };

type DemoShopDef = [suffix: string, name: string, kind: ShopKind, dLat: number, dLng: number, categories: string[]];

const SHOP_DEFS: DemoShopDef[] = [
  ['01', 'Demo covered market A', 'market', 0.0042, -0.0031, ['vegetables', 'fish', 'dairy-eggs']],
  ['02', 'Demo street market B', 'market', -0.0058, 0.0049, ['vegetables', 'grains-legumes']],
  ['03', 'Demo grocery C', 'grocery', 0.0021, 0.0068, ['grains-legumes', 'pantry', 'dairy-eggs', 'bakery']],
  ['04', 'Demo grocery D', 'grocery', -0.0074, -0.0062, ['grains-legumes', 'pantry', 'dairy-eggs', 'bakery']],
  ['05', 'Demo supermarket E', 'supermarket', 0.0089, 0.0021, ['vegetables', 'grains-legumes', 'pantry', 'dairy-eggs', 'meat-poultry']],
  ['06', 'Demo butcher F', 'butcher', -0.0019, -0.0088, ['meat-poultry']],
  ['07', 'Demo bakery G', 'bakery', 0.0063, -0.0079, ['bakery']],
  ['08', 'Demo greengrocer H', 'greengrocer', -0.0031, 0.0012, ['vegetables']],
];

export const DEMO_SHOPS: Shop[] = SHOP_DEFS.map(([suffix, name, kind, dLat, dLng]) => ({
  id: `d0000000-0000-4000-8000-0000000000${suffix}`,
  name,
  kind,
  wilaya_code: 17,
  area_id: 'djelfa',
  address_text: 'Synthetic demo location',
  lat: Number((DEMO_CENTER.lat + dLat).toFixed(6)),
  lng: Number((DEMO_CENTER.lng + dLng).toFixed(6)),
  provenance: 'demo',
  is_demo: true,
}));

/** Synthetic reference levels (DZD per comparison unit) used only to generate demo values. */
const DEMO_LEVEL: Record<string, string> = {
  potatoes: '90', onions: '70', tomatoes: '120', carrots: '100', zucchini: '110', 'green-peppers': '160',
  garlic: '900', coriander: '40', lentils: '280', chickpeas: '380', 'white-beans': '350', rice: '220',
  spaghetti: '180', couscous: '150', 'semolina-fine': '110', flour: '75', frik: '450', 'tomato-paste': '600',
  'vegetable-oil': '260', sugar: '110', eggs: '22', 'milk-pasteurised-bag': '25', 'milk-uht': '150',
  'chicken-whole': '450', lamb: '2400', 'beef-minced': '2200', sardines: '700', baguette: '10',
};

/** Package sizes the demo generator picks from: [quantity, unit]. */
const PACKAGES: Record<string, [string, UnitCode][]> = {
  potatoes: [['1', 'kg'], ['2', 'kg']], onions: [['1', 'kg']], tomatoes: [['1', 'kg']], carrots: [['1', 'kg']],
  zucchini: [['1', 'kg']], 'green-peppers': [['1', 'kg'], ['500', 'g']], garlic: [['250', 'g'], ['1', 'kg']],
  coriander: [['1', 'piece']], lentils: [['1', 'kg']], chickpeas: [['1', 'kg']], 'white-beans': [['1', 'kg']],
  rice: [['1', 'kg']], spaghetti: [['500', 'g']], couscous: [['1', 'kg']], 'semolina-fine': [['1', 'kg']],
  flour: [['1', 'kg']], frik: [['500', 'g']], 'tomato-paste': [['400', 'g'], ['800', 'g']],
  'vegetable-oil': [['1', 'l'], ['5', 'l']], sugar: [['1', 'kg']], eggs: [['30', 'piece'], ['1', 'piece']],
  'milk-pasteurised-bag': [['1', 'l']], 'milk-uht': [['1', 'l']], 'chicken-whole': [['1', 'kg']],
  lamb: [['1', 'kg']], 'beef-minced': [['1', 'kg'], ['500', 'g']], sardines: [['1', 'kg']], baguette: [['1', 'piece']],
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoObservationDef {
  id: string;
  product_id: string;
  shop_id: string;
  price: string;
  quantity: string;
  unit: UnitCode;
  days_ago: number;
}

/** Deterministic synthetic observations (same output on every run). */
export function demoObservationDefs(): DemoObservationDef[] {
  const rand = mulberry32(20261031);
  const out: DemoObservationDef[] = [];
  let n = 0;
  const id = () => `d1000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`;

  SHOP_DEFS.forEach(([suffix, , , , , cats], shopIndex) => {
    const shopId = `d0000000-0000-4000-8000-0000000000${suffix}`;
    // Shop D is deliberately left with only old reports to demonstrate stale handling.
    const staleShop = shopIndex === 3;
    for (const p of PRODUCTS) {
      if (!cats.includes(p.category_id)) continue;
      if (rand() > 0.8) continue; // not every shop has a report for every product
      const pkgs = PACKAGES[p.id]!;
      const [qty, unit] = pkgs[Math.floor(rand() * pkgs.length)]!;
      const level = new Big(DEMO_LEVEL[p.id]!);
      const historyCount = 1 + Math.floor(rand() * 3);
      let daysAgo = staleShop ? 40 + Math.floor(rand() * 30) : Math.floor(rand() * 9);
      for (let h = 0; h < historyCount; h++) {
        const factor = 0.82 + rand() * 0.4;
        const comparisonQty = unit === 'g' || unit === 'ml' ? new Big(qty).div(1000) : new Big(qty);
        let price = level.times(factor).times(comparisonQty);
        // Round package prices to 5 DZD when above 50 DZD, like shelf prices usually are.
        price = price.gt(50) ? price.div(5).round(0).times(5) : price.round(0);
        if (price.lte(0)) price = new Big(1);
        out.push({ id: id(), product_id: p.id, shop_id: shopId, price: roundMoney(price), quantity: qty, unit, days_ago: daysAgo });
        daysAgo += 6 + Math.floor(rand() * 20);
      }
    }
  });
  return out;
}

export function demoObservations(today: string): PriceObservation[] {
  return demoObservationDefs().map((d) => {
    const product = PRODUCTS.find((p) => p.id === d.product_id)!;
    const n = normalizeUnitPrice(d.price, d.quantity, d.unit, product.dimension);
    if (!n.ok) throw new Error(`Invalid demo fixture ${d.id}`);
    const observed = addDays(today, -d.days_ago);
    return {
      id: d.id,
      product_id: d.product_id,
      shop_id: d.shop_id,
      price: d.price,
      quantity: d.quantity,
      unit: d.unit,
      normalized_price: n.value,
      comparison_unit: n.unit,
      observed_on: observed,
      submitted_at: `${observed}T18:00:00.000Z`,
      source: 'demo',
      is_demo: true,
      corroborating_reports: 0,
    };
  });
}
