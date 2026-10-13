import { describe, expect, it } from 'vitest';
import { en, type MessageKey } from './en';
import { fr } from './fr';
import { ar } from './ar';
import { translate } from './I18nProvider';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  for (const [name, dict] of Object.entries({ fr, ar })) {
    it(`${name} has every key, non-empty, with the same placeholders`, () => {
      for (const key of Object.keys(en) as MessageKey[]) {
        expect(dict[key], `${name}:${key}`).toBeTruthy();
        expect(placeholders(dict[key]), `${name}:${key}`).toEqual(placeholders(en[key]));
      }
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    });
  }
  it('interpolates variables', () => {
    expect(translate('en', 'common.daysAgo', { n: 3 })).toBe('3 days ago');
    expect(translate('fr', 'common.daysAgo', { n: 3 })).toBe('il y a 3 jours');
  });
});
