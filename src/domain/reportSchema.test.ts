import { describe, expect, it } from 'vitest';
import { flagInput, priceReportInput, toReportErrorCode } from './reportSchema';

const valid = {
  product_id: 'potatoes',
  shop_id: '6f1c9a52-6b1e-4a43-9d1e-2a7f6f0e9c11',
  price: '180',
  quantity: '2',
  unit: 'kg',
  observed_on: '2026-10-10',
};

describe('priceReportInput (untrusted input)', () => {
  it('accepts a well-formed report', () => {
    expect(priceReportInput.safeParse(valid).success).toBe(true);
  });
  it.each([
    ['negative price', { price: '-1' }],
    ['zero price', { price: '0' }],
    ['too many decimals', { price: '1.234' }],
    ['huge price', { price: '9999999' }],
    ['exponent', { price: '1e5' }],
    ['zero quantity', { quantity: '0' }],
    ['bad unit', { unit: 'lb' }],
    ['bad product id', { product_id: "potatoes'; drop table" }],
    ['bad shop id', { shop_id: 'not-a-uuid' }],
    ['bad date', { observed_on: '11/10/2026' }],
    ['impossible date', { observed_on: '2026-13-45' }],
  ])('rejects %s', (_label, patch) => {
    expect(priceReportInput.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it('rejects protected fields a client might try to set', () => {
    for (const extra of [{ status: 'approved' }, { contributor_id: valid.shop_id }, { normalized_price: '1' }, { submitted_at: '2020-01-01' }]) {
      expect(priceReportInput.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });
  it('validates flags', () => {
    expect(flagInput.safeParse({ report_id: valid.shop_id, reason: 'spam' }).success).toBe(true);
    expect(flagInput.safeParse({ report_id: valid.shop_id, reason: 'hate' }).success).toBe(false);
    expect(flagInput.safeParse({ report_id: valid.shop_id, reason: 'other', note: 'x'.repeat(301) }).success).toBe(false);
  });
  it('maps database messages to known codes only', () => {
    expect(toReportErrorCode('rate_limited')).toBe('rate_limited');
    expect(toReportErrorCode('relation "x" does not exist')).toBe('server_error');
    expect(toReportErrorCode(undefined)).toBe('server_error');
  });
});
