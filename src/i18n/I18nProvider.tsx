import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale, LocalizedName } from '../domain/types';
import type { QuantityLabels } from '../domain/units';
import { en, type MessageKey } from './en';
import { fr } from './fr';
import { ar } from './ar';
import { readJson, writeJson } from '../platform/platform';

const DICTS: Record<Locale, Record<MessageKey, string>> = { en, fr, ar };

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  setLocale: (l: Locale) => void;
  t: TFunction;
  /** Pick the localized name of a catalogue record. */
  name: (r: LocalizedName) => string;
  variant: (r: { variant_en: string | null; variant_fr: string | null; variant_ar: string | null }) => string | null;
  /** Localized unit abbreviations for quantity formatting. */
  qtyLabels: QuantityLabels;
}

const I18nContext = createContext<I18nValue | null>(null);

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTS[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

function initialLocale(): Locale {
  const saved = readJson<string | null>('as3ari.locale', null);
  if (saved === 'en' || saved === 'fr' || saved === 'ar') return saved;
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writeJson('as3ari.locale', l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      name: (r) => (locale === 'fr' ? r.name_fr : locale === 'ar' ? r.name_ar : r.name_en) || r.name_en,
      variant: (r) => (locale === 'fr' ? r.variant_fr : locale === 'ar' ? r.variant_ar : r.variant_en) ?? r.variant_en,
      qtyLabels: {
        g: translate(locale, 'common.unit.g'),
        kg: translate(locale, 'common.unit.kg'),
        ml: translate(locale, 'common.unit.ml'),
        l: translate(locale, 'common.unit.l'),
        pcs: translate(locale, 'common.qty.pcs'),
      },
    }),
    [locale, dir, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
