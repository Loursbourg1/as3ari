import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Info, Map as MapIcon, MapPin } from 'lucide-react';
import { useAppData } from '../data/AppDataProvider';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../i18n/I18nProvider';
import { ObservationList } from '../components/ObservationList';
import { DemoBadge } from '../components/PriceBits';
import { Badge, Button, ErrorState, Notice, PageContainer, SectionTitle, Spinner } from '../components/ui';

const PAGE = 50;

export default function ShopPage() {
  const { id = '' } = useParams();
  const { t, name } = useI18n();
  const { catalog, repo, today, priceRevision } = useAppData();
  const [pages, setPages] = useState(1);
  const shop = useAsync(() => repo.getShop(id), [repo, id]);
  const obs = useAsync(() => repo.listObservations({ shopId: id, limit: PAGE * pages, offset: 0 }), [repo, id, pages, priceRevision]);
  const shopMap = useMemo(() => new Map(shop.data ? [[shop.data.id, shop.data]] : []), [shop.data]);

  if (!catalog.data || (shop.status === 'loading' && !shop.data)) return <Spinner />;
  if (shop.status === 'error') return <ErrorState onRetry={shop.reload} />;
  const s = shop.data;
  if (!s) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">{t('shop.notFound')}</p>
      </PageContainer>
    );
  }
  const area = catalog.data.areas.find((a) => a.id === s.area_id);
  const wilaya = catalog.data.wilayas.find((w) => w.code === s.wilaya_code);

  return (
    <PageContainer className="px-0">
      <div className="px-4">
        <Link to={`/?shop=${s.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('common.back')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">{s.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Badge>{t(`shop.kind.${s.kind}`)}</Badge>
          {s.is_demo && <DemoBadge />}
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {[s.address_text, area ? name(area) : null, wilaya ? name(wilaya) : null].filter(Boolean).join(' · ')}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">{t(`shop.provenance.${s.provenance}`)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/?shop=${s.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold">
            <MapIcon className="size-4" aria-hidden />
            {t('common.showOnMap')}
          </Link>
          {!s.is_demo && (
            <Link to={`/contribute?shop=${s.id}`} className="inline-flex h-9 items-center rounded-md bg-brand-600 px-3 text-sm font-semibold text-white">
              {t('shop.reportHere')}
            </Link>
          )}
        </div>
        <div className="mt-3">
          <Notice icon={<Info className="size-4" aria-hidden />}>{t('shop.notOfficial')}</Notice>
        </div>
      </div>

      <section className="mt-4 bg-surface">
        <SectionTitle>{t('shop.allHistory')}</SectionTitle>
        {obs.status === 'error' && <ErrorState onRetry={obs.reload} />}
        {obs.status === 'loading' && !obs.data && <Spinner />}
        {obs.data && obs.data.items.length === 0 && <p className="px-4 pb-4 text-sm text-muted">{t('shop.noObservations')}</p>}
        {obs.data && <ObservationList observations={obs.data.items} catalog={catalog.data} today={today} shops={shopMap} show="product" />}
        {obs.data && (obs.data.total ?? 0) > obs.data.items.length && (
          <div className="p-4">
            <Button onClick={() => setPages((n) => n + 1)} disabled={obs.status === 'loading'}>
              {t('common.loadMore')}
            </Button>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
