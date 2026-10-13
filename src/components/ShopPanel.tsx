import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Info, MapPin, PlusCircle } from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { useAsync } from '../lib/useAsync';
import type { Catalog, PriceObservation, Product, Shop } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { ObservationList } from './ObservationList';
import { DemoBadge } from './PriceBits';
import { Badge, ErrorState, Notice, Spinner } from './ui';

interface Props {
  shop: Shop;
  product: Product | null;
  /** Observations of the selected product at this shop (already loaded). */
  productObservations: PriceObservation[];
  catalog: Catalog;
  onBack: () => void;
}

export function ShopPanel({ shop, product, productObservations, catalog, onBack }: Props) {
  const { t, name } = useI18n();
  const { repo, today } = useAppData();
  const area = catalog.areas.find((a) => a.id === shop.area_id);
  const other = useAsync(() => repo.listObservations({ shopId: shop.id, limit: 200, offset: 0 }), [repo, shop.id]);

  const otherLatest = useMemo(() => {
    if (!other.data) return [];
    const byProduct = new Map<string, PriceObservation>();
    for (const o of other.data.items) {
      if (o.product_id === product?.id) continue;
      if (!byProduct.has(o.product_id)) byProduct.set(o.product_id, o);
    }
    return [...byProduct.values()];
  }, [other.data, product?.id]);

  const history = productObservations.filter((o) => o.shop_id === shop.id);
  const shopMap = useMemo(() => new Map([[shop.id, shop]]), [shop]);
  const contributeHref = `/contribute?shop=${shop.id}${product ? `&product=${product.id}` : ''}`;

  return (
    <div data-testid="shop-panel">
      <div className="flex items-start gap-2 border-b border-line px-3 py-3">
        <button type="button" onClick={onBack} aria-label={t('common.back')} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-canvas">
          <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-6 text-ink">{shop.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge>{t(`shop.kind.${shop.kind}`)}</Badge>
            {shop.is_demo && <DemoBadge />}
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="size-3" aria-hidden />
              {[shop.address_text, area ? name(area) : null].filter(Boolean).join(' · ')}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted">{t(`shop.provenance.${shop.provenance}`)}</p>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <Notice icon={<Info className="size-4" aria-hidden />}>{t('shop.notOfficial')}</Notice>
        {!shop.is_demo && (
          <Link to={contributeHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
            <PlusCircle className="size-4" aria-hidden />
            {t('shop.reportHere')}
          </Link>
        )}
      </div>

      {product && (
        <section aria-label={t('shop.selectedProduct', { product: name(product) })}>
          <h3 className="bg-canvas px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{t('shop.selectedProduct', { product: name(product) })}</h3>
          {history.length ? (
            <ObservationList observations={history} catalog={catalog} today={today} shops={shopMap} show="product" />
          ) : (
            <p className="px-4 py-3 text-sm text-muted">{t('shop.noObservationForProduct', { product: name(product) })}</p>
          )}
        </section>
      )}

      <section>
        <h3 className="bg-canvas px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{t('shop.otherProducts')}</h3>
        {other.status === 'loading' && !other.data && <Spinner />}
        {other.status === 'error' && <ErrorState onRetry={other.reload} />}
        {other.data && otherLatest.length === 0 && <p className="px-4 py-3 text-sm text-muted">{t('shop.noObservations')}</p>}
        {otherLatest.length > 0 && <ObservationList observations={otherLatest} catalog={catalog} today={today} shops={shopMap} show="product" />}
      </section>

      <div className="px-4 py-4">
        <Link to={`/shop/${shop.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
          {t('shop.allHistory')} →
        </Link>
      </div>
    </div>
  );
}
