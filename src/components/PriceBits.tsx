import { FlaskConical, ShieldCheck } from 'lucide-react';
import { formatDZD } from '../domain/money';
import { formatDate, daysBetween } from '../domain/dates';
import { formatQuantity } from '../domain/units';
import type { Freshness } from '../domain/freshness';
import type { ComparisonUnit, PriceObservation } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { Badge, cx } from './ui';

export function UnitPrice({ value, unit, size = 'lg' }: { value: string | null; unit: ComparisonUnit; size?: 'lg' | 'md' }) {
  const { t, locale } = useI18n();
  if (value === null) return <span className="text-sm text-muted">{t('compare.noUnitPrice')}</span>;
  return (
    <span className="num inline-flex items-baseline gap-0.5 whitespace-nowrap">
      <span className={cx('font-bold text-ink', size === 'lg' ? 'text-price' : 'text-base')}>{formatDZD(value, locale)}</span>
      <span className="text-xs font-semibold text-muted">{t(`common.perUnit.${unit}`)}</span>
    </span>
  );
}

/** "180 DZD for 2 kg" — the price as it was reported. */
export function ReportedPackage({ o }: { o: Pick<PriceObservation, 'price' | 'quantity' | 'unit'> }) {
  const { locale, qtyLabels } = useI18n();
  return (
    <span className="num text-xs text-ink-2">
      {formatDZD(o.price, locale)} · {formatQuantity(o.quantity, o.unit, qtyLabels)}
    </span>
  );
}

export function ObservedDate({ date, today }: { date: string; today: string }) {
  const { t, locale } = useI18n();
  const age = daysBetween(date, today);
  const rel = age <= 0 ? t('common.today') : age === 1 ? t('common.yesterday') : t('common.daysAgo', { n: age });
  return (
    <time dateTime={date} className="text-xs text-muted" title={formatDate(date, locale)}>
      {formatDate(date, locale)} · {rel}
    </time>
  );
}

export function FreshnessBadge({ f, recentDays }: { f: Freshness; recentDays: number }) {
  const { t } = useI18n();
  const tone = f.state === 'recent' ? 'good' : f.state === 'aging' ? 'warn' : 'stale';
  const title =
    f.state === 'recent' ? t('fresh.tooltip.recent', { n: recentDays }) : t(f.state === 'aging' ? 'fresh.tooltip.aging' : 'fresh.tooltip.stale', { age: f.ageDays });
  return (
    <Badge tone={tone} title={title}>
      {t(`fresh.${f.state}`)}
    </Badge>
  );
}

export function DemoBadge() {
  const { t } = useI18n();
  return (
    <Badge tone="demo" title={t('demo.banner')}>
      <FlaskConical className="size-3" aria-hidden />
      {t('common.demo')}
    </Badge>
  );
}

export function CorroboratedBadge({ n }: { n: number }) {
  const { t } = useI18n();
  if (n < 1) return null;
  return (
    <Badge tone="brand" title={t('compare.corroborated', { n })}>
      <ShieldCheck className="size-3" aria-hidden />
      {t('compare.corroborated', { n })}
    </Badge>
  );
}
