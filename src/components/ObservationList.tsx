import { Link } from 'react-router';
import { freshnessOf, thresholdsFor } from '../domain/freshness';
import type { Catalog, PriceObservation, Shop } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { CorroboratedBadge, DemoBadge, FreshnessBadge, ObservedDate, ReportedPackage, UnitPrice } from './PriceBits';
import { FlagButton } from './FlagButton';

/** A plain, dated list of individual observations (history). Never aggregated or smoothed. */
export function ObservationList({
  observations,
  catalog,
  today,
  shops,
  show,
}: {
  observations: PriceObservation[];
  catalog: Catalog;
  today: string;
  shops?: Map<string, Shop>;
  show: 'product' | 'shop';
}) {
  const { name, variant } = useI18n();
  return (
    <ul className="divide-y divide-line">
      {observations.map((o) => {
        const product = catalog.products.find((p) => p.id === o.product_id);
        const t = thresholdsFor(product?.category_id, catalog.categories);
        const f = freshnessOf(o.observed_on, today, t);
        const shop = shops?.get(o.shop_id);
        return (
          <li key={o.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5" data-testid="observation">
            <div className="min-w-0 flex-1">
              {show === 'product' && product ? (
                <Link to={`/product/${product.id}`} className="text-sm font-semibold text-ink hover:underline">
                  {name(product)}
                  {variant(product) && <span className="font-normal text-muted"> · {variant(product)}</span>}
                </Link>
              ) : (
                shop && (
                  <Link to={`/shop/${shop.id}`} className="text-sm font-semibold text-ink hover:underline">
                    {shop.name}
                  </Link>
                )
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <ObservedDate date={o.observed_on} today={today} />
                <FreshnessBadge f={f} recentDays={t.recent_days} />
                {o.is_demo && <DemoBadge />}
                <CorroboratedBadge n={o.corroborating_reports} />
              </div>
            </div>
            <div className="flex flex-col items-end text-end">
              <UnitPrice value={o.normalized_price} unit={o.comparison_unit} size="md" />
              <ReportedPackage o={o} />
            </div>
            <div className="basis-full">
              <FlagButton reportId={o.id} isDemo={o.is_demo} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
