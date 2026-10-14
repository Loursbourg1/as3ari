import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Info, Map as MapIcon } from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { useAsync } from '../lib/useAsync';
import { buildComparison } from '../domain/comparison';
import { COMPARISON_UNIT } from '../domain/units';
import type { PriceObservation } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { ComparisonList } from '../components/ComparisonList';
import { ObservationList } from '../components/ObservationList';
import { Button, ErrorState, Notice, PageContainer, SectionTitle, Spinner } from '../components/ui';

const PAGE = 50;

/** Price history and comparison for one product. Not a purchase page. */
export default function ProductPage() {
  const { id } = useParams();
  const { t, name, variant } = useI18n();
  const { catalog, repo, wilayaCode, wilaya, shops, today, priceRevision } = useAppData();
  const [pages, setPages] = useState(1);
  const product = catalog.data?.products.find((p) => p.id === id);

  const obs = useAsync(
    () => (product ? repo.listObservations({ wilayaCode, productIds: [product.id], limit: PAGE * pages, offset: 0 }) : Promise.resolve(null)),
    [repo, product?.id, wilayaCode, pages, priceRevision],
  );

  const shopMap = useMemo(() => new Map((shops.data ?? []).map((s) => [s.id, s])), [shops.data]);
  const comparison = useMemo(
    () =>
      product && obs.data && shops.data && catalog.data
        ? buildComparison({ product, observations: obs.data.items, shops: shops.data, categories: catalog.data.categories, today, sort: 'price' })
        : null,
    [product, obs.data, shops.data, catalog.data, today],
  );

  if (!catalog.data) return catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />;
  if (!product) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">{t('product.notFound')}</p>
      </PageContainer>
    );
  }

  const items: PriceObservation[] = obs.data?.items ?? [];
  const distinctDates = new Set(items.map((o) => o.observed_on)).size;
  const unit = COMPARISON_UNIT[product.dimension];

  return (
    <PageContainer className="px-0">
      <div className="px-4">
        <Link to={`/?product=${product.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('common.back')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          {name(product)}
          {variant(product) && <span className="ms-2 text-base font-medium text-muted">{variant(product)}</span>}
        </h1>
        <p className="text-sm text-muted">
          {t('product.history')} · {wilaya ? name(wilaya) : ''} · {t('product.comparedPer', { unit: t(`common.unit.${unit}`) })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/?product=${product.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold">
            <MapIcon className="size-4" aria-hidden />
            {t('common.showOnMap')}
          </Link>
          <Link to={`/contribute?product=${product.id}`} className="inline-flex h-9 items-center rounded-md bg-brand-600 px-3 text-sm font-semibold text-white">
            {t('nav.report')}
          </Link>
        </div>
        <div className="mt-3">
          <Notice icon={<Info className="size-4" aria-hidden />}>{t('product.variantNote')}</Notice>
        </div>
      </div>

      {obs.status === 'error' && <ErrorState onRetry={obs.reload} />}
      {obs.status === 'loading' && !obs.data && <Spinner />}

      {comparison && (
        <section className="mt-2 bg-surface">
          <SectionTitle>{t('product.latestByShop')}</SectionTitle>
          <div className="px-4 pb-2">
            <Notice tone={comparison.coverage === 'limited' || comparison.coverage === 'adequate' ? 'neutral' : 'warn'}>
              {t(`compare.coverage.${comparison.coverage}`, { n: comparison.currentShopCount, area: wilaya ? name(wilaya) : '' })}
            </Notice>
          </div>
          <ComparisonList
            rows={comparison.rows}
            product={product}
            categories={catalog.data.categories}
            areas={catalog.data.areas}
            today={today}
            selectedShopId={null}
            onSelect={() => undefined}
          />
        </section>
      )}

      {obs.data && (
        <section className="mt-4 bg-surface">
          <SectionTitle>{t('product.allObservations')}</SectionTitle>
          {distinctDates < 2 && (
            <div className="px-4 pb-2">
              <Notice tone="warn">{t('product.historyInsufficient')}</Notice>
            </div>
          )}
          <ObservationList observations={items} catalog={catalog.data} today={today} shops={shopMap} show="shop" />
          {(obs.data.total ?? 0) > items.length && (
            <div className="p-4">
              <Button onClick={() => setPages((n) => n + 1)} disabled={obs.status === 'loading'}>
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}
