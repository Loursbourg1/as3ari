import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../domain/dates';
import { useI18n } from '../i18n/I18nProvider';
import { ReportedPackage, UnitPrice } from '../components/PriceBits';
import { Badge, ErrorState, Notice, PageContainer, Spinner } from '../components/ui';

export default function MyReportsPage() {
  const { t, name, locale } = useI18n();
  const auth = useAuth();
  const { contributions, catalog, shops } = useAppData();
  const reports = useAsync(() => (auth.session ? contributions.myReports(100, 0) : Promise.resolve([])), [auth.session?.user.id, contributions]);

  if (auth.loading) return <Spinner />;
  if (!auth.available) {
    return (
      <PageContainer>
        <Notice tone="demo">{t('auth.unavailable')}</Notice>
      </PageContainer>
    );
  }
  if (!auth.session) return <Navigate to="/signin?next=%2Fme" replace />;

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">{t('me.title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('auth.signedInAs', { email: auth.email ?? '' })}</p>
      {reports.status === 'error' && <ErrorState onRetry={reports.reload} />}
      {reports.status === 'loading' && !reports.data && <Spinner />}
      {reports.data && reports.data.length === 0 && <p className="mt-4 text-sm text-muted">{t('me.empty')}</p>}
      <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
        {reports.data?.map((r) => {
          const product = catalog.data?.products.find((p) => p.id === r.product_id);
          const shop = shops.data?.find((s) => s.id === r.shop_id);
          return (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3" data-testid="my-report">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{product ? name(product) : r.product_id}</p>
                <p className="truncate text-xs text-muted">{shop?.name ?? ''}</p>
                <p className="text-xs text-muted">
                  {formatDate(r.observed_on, locale)} · {t('me.submitted', { date: formatDate(r.submitted_at.slice(0, 10), locale) })}
                </p>
                {r.rejection_reason && <p className="mt-1 text-xs text-danger">{t('me.reason', { reason: r.rejection_reason })}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 text-end">
                <Badge tone={r.status === 'approved' ? 'good' : r.status === 'rejected' ? 'danger' : 'warn'}>{t(`me.status.${r.status}`)}</Badge>
                <UnitPrice value={r.normalized_price} unit={r.comparison_unit} size="md" />
                <ReportedPackage o={r} />
              </div>
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
