import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '../data/AppDataProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { PriceObservation } from '../domain/types';
import { PriceTrendChart } from '../components/PriceTrendChart';
import { ErrorState, PageContainer, Spinner } from '../components/ui';

export default function TrendsPage() {
  const { name } = useI18n();
  const { repo, catalog, wilayaCode, wilaya } = useAppData();
  const cat = catalog.data;

  const [observations, setObservations] = useState<PriceObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadObservations = useCallback(async () => {
    if (!cat) return;
    setLoading(true);
    setError(false);
    try {
      const res = await repo.listObservations({
        wilayaCode,
        limit: 500,
        offset: 0,
      });
      setObservations(res.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [cat, repo, wilayaCode]);

  useEffect(() => {
    if (cat) {
      loadObservations();
    }
  }, [cat, wilayaCode, loadObservations]);

  if (!cat) {
    return (
      <div className="flex h-full items-center justify-center">
        {catalog.status === 'error' ? <ErrorState onRetry={catalog.reload} /> : <Spinner />}
      </div>
    );
  }

  if (loading && observations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error && observations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <ErrorState onRetry={loadObservations} />
      </div>
    );
  }

  const currentWilayaName = wilaya ? name(wilaya) : 'Algeria';

  return (
    <PageContainer className="max-w-4xl py-4 sm:py-6">
      <PriceTrendChart
        wilayaCode={wilayaCode}
        wilayaName={currentWilayaName}
        catalog={cat}
        observations={observations}
      />
    </PageContainer>
  );
}
