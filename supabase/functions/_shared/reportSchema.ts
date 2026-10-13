// SHARED SCHEMA — an identical copy lives in supabase/functions/_shared/reportSchema.ts
// (only the zod import line differs). A unit test fails if the two drift apart.
import { z } from 'npm:zod@4';

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY = /^\d{1,7}(\.\d{1,2})?$/;
const QTY = /^\d{1,6}(\.\d{1,3})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Untrusted price-report input. Only the fields a contributor may set are accepted;
 * reporter id, normalized price, status and timestamps are always derived server-side.
 */
export const priceReportInput = z
  .object({
    product_id: z.string().regex(SLUG),
    shop_id: z.string().regex(UUID),
    price: z.string().regex(MONEY),
    quantity: z.string().regex(QTY),
    unit: z.enum(['g', 'kg', 'ml', 'l', 'piece']),
    observed_on: z.string().regex(DATE),
  })
  .strict()
  .refine((v) => Number(v.price) > 0 && Number(v.price) <= 1_000_000, { path: ['price'], message: 'invalid_price' })
  .refine((v) => Number(v.quantity) > 0, { path: ['quantity'], message: 'invalid_quantity' })
  .refine((v) => !Number.isNaN(Date.parse(`${v.observed_on}T00:00:00Z`)), { path: ['observed_on'], message: 'invalid_date' });

export type PriceReportInput = z.infer<typeof priceReportInput>;

export const flagInput = z
  .object({
    report_id: z.string().regex(UUID),
    reason: z.enum(['wrong_price', 'wrong_shop', 'wrong_product', 'duplicate', 'spam', 'other']),
    note: z.string().max(300).optional(),
  })
  .strict();

export type FlagInput = z.infer<typeof flagInput>;

/** Error codes raised by the database / edge function; mapped to translated messages in the UI. */
export const REPORT_ERROR_CODES = [
  'not_authenticated',
  'email_not_verified',
  'invalid_input',
  'unknown_product',
  'unknown_shop',
  'unit_mismatch',
  'invalid_price',
  'invalid_quantity',
  'invalid_date',
  'implausible_price',
  'duplicate_report',
  'rate_limited',
  'not_allowed',
  'server_error',
] as const;

export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[number];

export function toReportErrorCode(message: string | undefined | null): ReportErrorCode {
  const m = (message ?? '').toLowerCase();
  return REPORT_ERROR_CODES.find((c) => m.includes(c)) ?? 'server_error';
}
