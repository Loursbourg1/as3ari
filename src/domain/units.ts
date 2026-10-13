import { Big, roundMoney, stripZeros } from './money';
import type { ComparisonUnit, Dimension, UnitCode } from './types';

interface UnitDef {
  dimension: Dimension;
  /** Factor to the dimension's base unit (g, ml, piece). */
  toBase: string;
}

export const UNITS: Record<UnitCode, UnitDef> = {
  g: { dimension: 'mass', toBase: '1' },
  kg: { dimension: 'mass', toBase: '1000' },
  ml: { dimension: 'volume', toBase: '1' },
  l: { dimension: 'volume', toBase: '1000' },
  piece: { dimension: 'count', toBase: '1' },
};

export const COMPARISON_UNIT: Record<Dimension, ComparisonUnit> = {
  mass: 'kg',
  volume: 'l',
  count: 'piece',
};

export const BASE_UNIT: Record<Dimension, UnitCode> = { mass: 'g', volume: 'ml', count: 'piece' };

/**
 * Accepted quantity bounds per submitted unit. Mirrors the checks in the
 * submit_price_report() database function — keep both in sync.
 */
export const QUANTITY_BOUNDS: Record<UnitCode, { min: string; max: string; integer?: boolean }> = {
  g: { min: '1', max: '100000' },
  kg: { min: '0.001', max: '100' },
  ml: { min: '1', max: '100000' },
  l: { min: '0.001', max: '100' },
  piece: { min: '1', max: '1000', integer: true },
};

export function unitsForDimension(d: Dimension): UnitCode[] {
  return (Object.keys(UNITS) as UnitCode[]).filter((u) => UNITS[u].dimension === d);
}

export function isUnitCode(u: unknown): u is UnitCode {
  return typeof u === 'string' && Object.prototype.hasOwnProperty.call(UNITS, u);
}

export function quantityWithinBounds(quantity: Big.BigSource, unit: UnitCode): boolean {
  const b = QUANTITY_BOUNDS[unit];
  const q = new Big(quantity);
  if (b.integer && !q.mod(1).eq(0)) return false;
  return q.gte(b.min) && q.lte(b.max);
}

/** Convert a quantity to the dimension's base unit (g / ml / piece). */
export function toBaseQuantity(quantity: Big.BigSource, unit: UnitCode): Big {
  return new Big(quantity).times(UNITS[unit].toBase);
}

/** Convert a base-unit quantity to the comparison unit (kg / l / piece). */
export function baseToComparison(base: Big.BigSource, dimension: Dimension): Big {
  return new Big(base).div(UNITS[COMPARISON_UNIT[dimension]].toBase);
}

export type NormalizeResult =
  | { ok: true; value: string; unit: ComparisonUnit }
  | { ok: false; error: 'invalid_price' | 'invalid_quantity' | 'unit_mismatch' };

/**
 * Normalize a package price to a price per comparison unit.
 * Example: 180 DZD for 2 kg -> "90.00" DZD/kg.
 * If `expected` is given, units of another dimension are rejected: a per-item
 * product is never compared with a per-weight product without a valid conversion.
 */
export function normalizeUnitPrice(
  price: Big.BigSource,
  quantity: Big.BigSource,
  unit: UnitCode,
  expected?: Dimension,
): NormalizeResult {
  let p: Big;
  let q: Big;
  try {
    p = new Big(price);
  } catch {
    return { ok: false, error: 'invalid_price' };
  }
  try {
    q = new Big(quantity);
  } catch {
    return { ok: false, error: 'invalid_quantity' };
  }
  if (p.lte(0)) return { ok: false, error: 'invalid_price' };
  if (q.lte(0)) return { ok: false, error: 'invalid_quantity' };
  const def = UNITS[unit];
  if (!def) return { ok: false, error: 'unit_mismatch' };
  if (expected && def.dimension !== expected) return { ok: false, error: 'unit_mismatch' };
  const cu = COMPARISON_UNIT[def.dimension];
  const qtyInComparison = toBaseQuantity(q, unit).div(UNITS[cu].toBase);
  return { ok: true, value: roundMoney(p.div(qtyInComparison)), unit: cu };
}

/** Two observations are comparable only if they share a product and a comparison unit. */
export function areComparable(
  a: { product_id: string; comparison_unit: ComparisonUnit },
  b: { product_id: string; comparison_unit: ComparisonUnit },
): boolean {
  return a.product_id === b.product_id && a.comparison_unit === b.comparison_unit;
}

export interface QuantityLabels {
  g: string;
  kg: string;
  ml: string;
  l: string;
  pcs: string;
}
const DEFAULT_LABELS: QuantityLabels = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', pcs: 'pcs' };

/** Human-friendly base quantity: 1500 g -> "1.5 kg", 750 ml -> "750 ml", 6 piece -> "6 pcs". */
export function formatBaseQuantity(base: Big.BigSource, dimension: Dimension, labels: QuantityLabels = DEFAULT_LABELS): string {
  const q = new Big(base);
  if (dimension === 'mass') return q.gte(1000) ? `${trim(q.div(1000))} ${labels.kg}` : `${trim(q)} ${labels.g}`;
  if (dimension === 'volume') return q.gte(1000) ? `${trim(q.div(1000))} ${labels.l}` : `${trim(q)} ${labels.ml}`;
  return `${trim(q)} ${labels.pcs}`;
}

export function formatQuantity(quantity: Big.BigSource, unit: UnitCode, labels?: QuantityLabels): string {
  return formatBaseQuantity(toBaseQuantity(quantity, unit), UNITS[unit].dimension, labels);
}

function trim(b: Big): string {
  return stripZeros(b.round(2).toFixed(2));
}
