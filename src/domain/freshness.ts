import { daysBetween } from './dates';
import type { Category, FreshnessState } from './types';

export interface FreshnessThresholds {
  recent_days: number;
  stale_days: number;
}

/** Fallback when a product's category cannot be resolved. Documented in docs/DATA.md. */
export const DEFAULT_THRESHOLDS: FreshnessThresholds = { recent_days: 7, stale_days: 21 };

export interface Freshness {
  state: FreshnessState;
  ageDays: number;
}

/**
 * recent: age <= recent_days
 * aging:  recent_days < age <= stale_days (still usable, flagged as older)
 * stale:  age > stale_days (kept in history, never presented as a current price)
 */
export function freshnessOf(observedOn: string, today: string, t: FreshnessThresholds = DEFAULT_THRESHOLDS): Freshness {
  const ageDays = Math.max(0, daysBetween(observedOn, today));
  const state: FreshnessState = ageDays <= t.recent_days ? 'recent' : ageDays <= t.stale_days ? 'aging' : 'stale';
  return { state, ageDays };
}

export function thresholdsFor(categoryId: string | undefined, categories: Category[]): FreshnessThresholds {
  const c = categories.find((x) => x.id === categoryId);
  return c ? { recent_days: c.recent_days, stale_days: c.stale_days } : DEFAULT_THRESHOLDS;
}

export function isCurrent(f: Freshness): boolean {
  return f.state !== 'stale';
}
