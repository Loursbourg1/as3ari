/** Date helpers working on calendar dates (YYYY-MM-DD) to avoid timezone drift. */
const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today's calendar date in Algeria (Africa/Algiers, UTC+1, no DST). */
export function todayInAlgeria(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function formatDate(iso: string, locale: 'en' | 'fr' | 'ar' = 'en'): string {
  const tag = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' }[locale];
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    numberingSystem: 'latn',
  }).format(new Date(`${iso}T00:00:00Z`));
}
