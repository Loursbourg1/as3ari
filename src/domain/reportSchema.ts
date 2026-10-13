// SHARED SCHEMA — an identical copy lives in supabase/functions/_shared/reportSchema.ts
// (only the zod import line differs). A unit test fails if the two drift apart.
import { z } from 'zod';

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY = /^\d{1,7}(\.\d{1,2})?$/;
const QTY = /^\d{1,6}(\.\d{1,3})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const HTTP_URL = /^https?:\/\//i;

/**
 * Untrusted price-report input. Only the fields a contributor may set are accepted;
 * reporter id, normalized price, status and timestamps are always derived server-side.
 * Location is provided by the contributor (label + optional GPS) — there is no shop list.
 */
export const priceReportInput = z
  .object({
    product_id: z.string().regex(SLUG),
    shop_id: z.string().regex(UUID).optional().nullable(),
    price: z.string().regex(MONEY),
    quantity: z.string().regex(QTY),
    unit: z.enum(['g', 'kg', 'ml', 'l', 'piece']),
    observed_on: z.string().regex(DATE),
    location_label: z.string().trim().min(2).max(120).optional().nullable(),
    wilaya_code: z.number().int().min(1).max(99).optional().nullable(),
    area_id: z.string().trim().max(120).optional().nullable(),
    lat: z.number().gte(-90).lte(90).nullable().optional(),
    lng: z.number().gte(-180).lte(180).nullable().optional(),
    photo_url: z
      .string()
      .min(12)
      .max(2_500_000)
      .refine((v) => DATA_URL.test(v) || HTTP_URL.test(v) || v.startsWith('/'), { message: 'missing_photo' })
      .optional()
      .nullable(),
    is_anonymous: z.boolean().optional().default(true),
    reporter_name: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-zA-Z0-9_\-\. ]+$/, { message: 'invalid_input' })
      .optional()
      .nullable(),
    recaptcha_token: z.string().max(4096).optional().nullable(),
  })
  .strict()
  .refine((v) => Number(v.price) > 0 && Number(v.price) <= 1_000_000, { path: ['price'], message: 'invalid_price' })
  .refine((v) => Number(v.quantity) > 0, { path: ['quantity'], message: 'invalid_quantity' })
  .refine((v) => !Number.isNaN(Date.parse(`${v.observed_on}T00:00:00Z`)), { path: ['observed_on'], message: 'invalid_date' })
  .refine((v) => ((v.lat ?? null) === null) === ((v.lng ?? null) === null), { path: ['lat'], message: 'invalid_input' })
  .refine((v) => Boolean(v.shop_id || v.location_label), { path: ['location_label'], message: 'missing_location' });

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
  'missing_photo',
  'missing_location',
  'captcha_required',
  'captcha_failed',
  'server_error',
] as const;

export type ReportErrorCode = (typeof REPORT_ERROR_CODES)[number];

export function toReportErrorCode(message: string | undefined | null): ReportErrorCode {
  const m = (message ?? '').toLowerCase();
  return REPORT_ERROR_CODES.find((c) => m.includes(c)) ?? 'server_error';
}
