import Big from 'big.js';

// Half-up rounding (matches PostgreSQL round() for positive numerics).
Big.RM = Big.roundHalfUp;
Big.DP = 10;

export { Big };

const MONEY_RE = /^\d{1,9}(\.\d{1,2})?$/;
const QTY_RE = /^\d{1,6}(\.\d{1,3})?$/;

/** Parse a user-entered amount ("180", "180.5", "180,50") into a canonical decimal string. */
export function parseMoney(input: string): string | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!MONEY_RE.test(s)) return null;
  const v = new Big(s);
  if (v.lte(0)) return null;
  return v.toFixed(2);
}

/** Parse a user-entered quantity into a canonical decimal string (max 3 decimals). */
export function parseQuantity(input: string): string | null {
  const s = input.trim().replace(',', '.');
  if (!QTY_RE.test(s)) return null;
  const v = new Big(s);
  if (v.lte(0)) return null;
  return stripZeros(v.toFixed(3));
}

export function stripZeros(fixed: string): string {
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

export function roundMoney(v: Big.BigSource): string {
  return new Big(v).round(2, Big.roundHalfUp).toFixed(2);
}

export function sumMoney(values: Big.BigSource[]): string {
  return roundMoney(values.reduce<Big>((acc, v) => acc.plus(v), new Big(0)));
}

const LOCALE_TAG = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' } as const;

/** Format a DZD amount for display. Drops ".00" for whole dinars. */
export function formatDZD(value: Big.BigSource, locale: keyof typeof LOCALE_TAG = 'en'): string {
  const b = new Big(value);
  const whole = b.mod(1).eq(0);
  const formatted = new Intl.NumberFormat(LOCALE_TAG[locale], {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(Number(b.toFixed(2)));
  return locale === 'ar' ? `${formatted} د.ج` : `${formatted} DZD`;
}
