/**
 * Converts reviewed CSV files of VERIFIED shops or GENUINE price observations into
 * a SQL file you can inspect and then run in the Supabase SQL editor (or psql).
 * Nothing is sent anywhere by this script and it needs no credentials.
 *
 *   npm run import:shops  -- data/import/shops.csv  > supabase/imports/shops-2026-10-11.sql
 *   npm run import:prices -- data/import/prices.csv > supabase/imports/prices-2026-10-11.sql
 *
 * See docs/DATA_IMPORT.md for column definitions and the provenance rules.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { PRODUCTS } from '../src/data/reference/catalog';
import { LOCAL_AREAS, WILAYAS } from '../src/data/reference/geography';
import { normalizeUnitPrice } from '../src/domain/units';
import { Big } from '../src/domain/money';
import { isIsoDate } from '../src/domain/dates';
import { lit } from './sql';

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h, i) => (i === 0 && h.charCodeAt(0) === 0xfeff ? h.slice(1) : h).trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const wilayaCodes = new Set(WILAYAS.map((w) => w.code));
const areaIds = new Set(LOCAL_AREAS.map((a) => a.id));

const shopRow = z.object({
  name: z.string().min(2).max(120),
  kind: z.enum(['shop', 'market', 'supermarket', 'butcher', 'bakery', 'greengrocer', 'grocery']),
  wilaya_code: z.coerce.number().int().refine((n) => wilayaCodes.has(n), 'unknown wilaya'),
  area_id: z.string().refine((a) => a === '' || areaIds.has(a), 'unknown area_id (add it to src/data/reference/geography.ts first)'),
  address_text: z.string().max(200),
  lat: z.coerce.number().min(18).max(38),
  lng: z.coerce.number().min(-9).max(12.5),
  // Demo provenance is deliberately not accepted here.
  provenance: z.enum(['verified_visit', 'official_source', 'openstreetmap']),
  provenance_note: z.string().min(3, 'say how the location was verified').max(300),
});

const priceRow = z.object({
  product_id: z.string().refine((p) => PRODUCTS.some((x) => x.id === p), 'unknown product_id'),
  shop_name: z.string().min(2).max(120),
  wilaya_code: z.coerce.number().int().refine((n) => wilayaCodes.has(n), 'unknown wilaya'),
  price: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/),
  quantity: z.string().regex(/^\d{1,6}(\.\d{1,3})?$/),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'piece']),
  observed_on: z.string().refine(isIsoDate, 'use YYYY-MM-DD'),
  provenance_note: z.string().min(3, 'say who observed the price and how').max(300),
});

export class ImportError extends Error {}

function fail(errors: string[]): never {
  throw new ImportError(`${errors.length} invalid row(s) — nothing generated:\n${errors.join('\n')}`);
}

export function shopsSql(rows: Record<string, string>[]): string {
  const errors: string[] = [];
  const values: string[] = [];
  rows.forEach((r, i) => {
    const p = shopRow.safeParse(r);
    if (!p.success) return errors.push(`row ${i + 2}: ${p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
    const s = p.data;
    values.push(
      `  (${[lit(s.name), lit(s.kind), s.wilaya_code, lit(s.area_id || null), lit(s.address_text || null), s.lat.toFixed(6), s.lng.toFixed(6), lit(s.provenance), lit(s.provenance_note)].join(', ')})`,
    );
  });
  if (errors.length) fail(errors);
  return `-- Verified shops import (${values.length} rows). Review before running.\nbegin;\ninsert into public.shops (name, kind, wilaya_code, area_id, address_text, lat, lng, provenance, provenance_note) values\n${values.join(',\n')}\non conflict (name, lat, lng) do nothing;\ncommit;\n`;
}

export function pricesSql(rows: Record<string, string>[]): string {
  const errors: string[] = [];
  const stmts: string[] = [];
  rows.forEach((r, i) => {
    const p = priceRow.safeParse(r);
    if (!p.success) return errors.push(`row ${i + 2}: ${p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
    const v = p.data;
    const product = PRODUCTS.find((x) => x.id === v.product_id)!;
    const n = normalizeUnitPrice(v.price, v.quantity, v.unit, product.dimension);
    if (!n.ok) return errors.push(`row ${i + 2}: ${n.error}`);
    if (new Big(n.value).lt(product.min_unit_price) || new Big(n.value).gt(product.max_unit_price)) {
      return errors.push(`row ${i + 2}: implausible unit price ${n.value} for ${product.id}`);
    }
    // Normalization is recomputed in SQL by the trusted normalize_price() function.
    stmts.push(
      `insert into public.price_reports (product_id, shop_id, price, quantity, unit, comparison_unit, normalized_price, observed_on, status, source, provenance_note)\n` +
        `select ${lit(v.product_id)}, s.id, ${v.price}, ${v.quantity}, ${lit(v.unit)}, n.comparison_unit, n.normalized_price, ${lit(v.observed_on)}, 'approved', 'import', ${lit(v.provenance_note)}\n` +
        `from public.shops s, public.normalize_price(${v.price}, ${v.quantity}, ${lit(v.unit)}) n\n` +
        `where s.name = ${lit(v.shop_name)} and s.wilaya_code = ${v.wilaya_code} and not s.is_demo;`,
    );
  });
  if (errors.length) fail(errors);
  return `-- Genuine price observations import (${stmts.length} rows). Review before running.\n-- Each statement inserts nothing if the shop name is not found — check the row counts.\nbegin;\n${stmts.join('\n')}\ncommit;\n`;
}

const isCli = (process.argv[1] ?? '').split('\\').join('/').endsWith('scripts/import-csv.ts');
if (isCli) {
  const [kind, file] = process.argv.slice(2);
  if ((kind !== 'shops' && kind !== 'prices') || !file) {
    console.error('usage: tsx scripts/import-csv.ts <shops|prices> <file.csv>');
    process.exit(2);
  }
  try {
    const rows = parseCsv(readFileSync(file, 'utf8'));
    process.stdout.write(kind === 'shops' ? shopsSql(rows) : pricesSql(rows));
  } catch (e) {
    console.error(e instanceof ImportError ? e.message : e);
    process.exit(1);
  }
}
