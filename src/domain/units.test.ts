import { describe, expect, it } from 'vitest';
import { areComparable, formatQuantity, normalizeUnitPrice, quantityWithinBounds, toBaseQuantity } from './units';
import { formatDZD, parseMoney, parseQuantity, roundMoney, sumMoney } from './money';

describe('normalizeUnitPrice', () => {
  it('180 DZD for 2 kg is 90 DZD/kg', () => {
    expect(normalizeUnitPrice('180', '2', 'kg')).toEqual({ ok: true, value: '90.00', unit: 'kg' });
  });
  it('converts grams to price per kg', () => {
    expect(normalizeUnitPrice('90', '500', 'g')).toEqual({ ok: true, value: '180.00', unit: 'kg' });
  });
  it('converts millilitres to price per litre', () => {
    expect(normalizeUnitPrice('65', '250', 'ml')).toEqual({ ok: true, value: '260.00', unit: 'l' });
  });
  it('per-item prices stay per item', () => {
    expect(normalizeUnitPrice('660', '30', 'piece')).toEqual({ ok: true, value: '22.00', unit: 'piece' });
  });
  it('rounds half up to 2 decimals', () => {
    // 100 / 3 kg = 33.333.. -> 33.33 ; 1 / 0.008 kg = 125 ; 0.05/ 2 = 0.025 -> 0.03
    expect(normalizeUnitPrice('100', '3', 'kg')).toMatchObject({ value: '33.33' });
    expect(normalizeUnitPrice('0.05', '2', 'kg')).toMatchObject({ value: '0.03' });
  });
  it('avoids binary floating point drift', () => {
    // 0.1 + 0.2 style trap: 0.3 DZD for 3 pieces must be exactly 0.10
    expect(normalizeUnitPrice('0.3', '3', 'piece')).toMatchObject({ value: '0.10' });
  });
  it('rejects zero/negative/invalid values', () => {
    expect(normalizeUnitPrice('0', '1', 'kg')).toEqual({ ok: false, error: 'invalid_price' });
    expect(normalizeUnitPrice('-5', '1', 'kg')).toEqual({ ok: false, error: 'invalid_price' });
    expect(normalizeUnitPrice('10', '0', 'kg')).toEqual({ ok: false, error: 'invalid_quantity' });
    expect(normalizeUnitPrice('abc', '1', 'kg')).toEqual({ ok: false, error: 'invalid_price' });
  });
  it('refuses to compare a per-item product with a per-weight unit', () => {
    expect(normalizeUnitPrice('22', '1', 'piece', 'mass')).toEqual({ ok: false, error: 'unit_mismatch' });
    expect(normalizeUnitPrice('90', '1', 'kg', 'count')).toEqual({ ok: false, error: 'unit_mismatch' });
  });
});

describe('comparability', () => {
  it('requires same product and same comparison unit', () => {
    expect(areComparable({ product_id: 'eggs', comparison_unit: 'piece' }, { product_id: 'eggs', comparison_unit: 'piece' })).toBe(true);
    expect(areComparable({ product_id: 'eggs', comparison_unit: 'piece' }, { product_id: 'eggs', comparison_unit: 'kg' })).toBe(false);
    expect(areComparable({ product_id: 'milk-uht', comparison_unit: 'l' }, { product_id: 'milk-pasteurised-bag', comparison_unit: 'l' })).toBe(false);
  });
});

describe('quantities', () => {
  it('converts to base units', () => {
    expect(toBaseQuantity('1.5', 'kg').toFixed(0)).toBe('1500');
    expect(toBaseQuantity('2', 'l').toFixed(0)).toBe('2000');
  });
  it('enforces bounds per unit', () => {
    expect(quantityWithinBounds('2', 'kg')).toBe(true);
    expect(quantityWithinBounds('500', 'kg')).toBe(false);
    expect(quantityWithinBounds('1.5', 'piece')).toBe(false);
    expect(quantityWithinBounds('0.5', 'g')).toBe(false);
  });
  it('formats quantities readably', () => {
    expect(formatQuantity('1500', 'g')).toBe('1.5 kg');
    expect(formatQuantity('750', 'ml')).toBe('750 ml');
    expect(formatQuantity('30', 'piece')).toBe('30 pcs');
  });
});

describe('money', () => {
  it('parses user input safely', () => {
    expect(parseMoney('180')).toBe('180.00');
    expect(parseMoney(' 1 250,5 ')).toBe('1250.50');
    expect(parseMoney('12.345')).toBeNull();
    expect(parseMoney('-3')).toBeNull();
    expect(parseMoney('0')).toBeNull();
    expect(parseMoney('1e5')).toBeNull();
    expect(parseQuantity('0,5')).toBe('0.5');
    expect(parseQuantity('2.000')).toBe('2');
    expect(parseQuantity('abc')).toBeNull();
  });
  it('sums and rounds decimals exactly', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(roundMoney('2.345')).toBe('2.35');
    expect(roundMoney('2.344')).toBe('2.34');
  });
  it('formats DZD', () => {
    expect(formatDZD('90.00')).toBe('90 DZD');
    expect(formatDZD('1250.5')).toBe('1,250.50 DZD');
  });
});
