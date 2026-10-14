import { useState } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { ApiError } from '../data/repository';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../domain/dates';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { ReportedPackage, UnitPrice } from '../components/PriceBits';
import { Badge, Button, ErrorState, Notice, PageContainer, Spinner, TextInput, cx } from '../components/ui';

/** Lightweight moderation queue. Access is enforced by the database (is_moderator), not by this UI. */
export default function ModerationPage() {
  const { t, name, locale } = useI18n();
  const auth = useAuth();
  const { contributions, catalog } = useAppData();
  const [tab, setTab] = useState<'pending' | 'flagged'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queue = useAsync(
    () => (auth.session ? contributions.moderationQueue(tab === 'pending' ? 'pending' : 'approved', tab === 'flagged') : Promise.resolve([])),
    [auth.session?.user.id, tab, contributions],
  );

  if (auth.loading) return <Spinner />;
  if (!auth.available) {
    return (
      <PageContainer>
        <Notice tone="demo">{t('auth.unavailable')}</Notice>
      </PageContainer>
    );
  }
  if (!auth.session) return <Navigate to="/signin?next=%2Fmoderate" replace />;
  const notAllowed = queue.status === 'error' && queue.error instanceof ApiError && queue.error.code === 'not_allowed';

  async function act(id: string, decision: 'approve' | 'reject') {
    setBusyId(id);
    setActionError(null);
    try {
      await contributions.moderate(id, decision, notes[id]);
      queue.reload();
    } catch (e) {
      setActionError(t(`errors.${e instanceof ApiError ? e.code : 'server_error'}` as MessageKey));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">{t('mod.title')}</h1>
      {notAllowed ? (
        <div className="mt-4">
          <Notice tone="warn">{t('mod.notAllowed')}</Notice>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-1" role="tablist">
            {(['pending', 'flagged'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx('rounded-md px-3 py-1.5 text-sm font-semibold', tab === k ? 'bg-brand-600 text-white' : 'bg-surface text-ink-2')}
              >
                {t(k === 'pending' ? 'mod.pending' : 'mod.flagged')}
              </button>
            ))}
          </div>
          {actionError && <p className="mt-2 text-sm text-danger">{actionError}</p>}
          {queue.status === 'error' && !notAllowed && <ErrorState onRetry={queue.reload} />}
          {queue.status === 'loading' && <Spinner />}
          {queue.data && queue.data.length === 0 && <p className="mt-4 text-sm text-muted">{t('mod.empty')}</p>}
          <ul className="mt-3 space-y-2">
            {queue.data?.map((r) => {
              const product = catalog.data?.products.find((p) => p.id === r.product_id);
              return (
                <li key={r.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{product ? name(product) : r.product_id}</p>
                      <p className="text-sm text-ink-2">{r.shop_name}</p>
                      <p className="text-xs text-muted">
                        {formatDate(r.observed_on, locale)} · {t('mod.contributorReports', { n: r.contributor_report_count })}
                      </p>
                      {r.open_flags > 0 && <Badge tone="danger">{t('mod.flags', { n: r.open_flags })}</Badge>}
                    </div>
                    <div className="flex flex-col items-end text-end">
                      <UnitPrice value={r.normalized_price} unit={r.comparison_unit} size="md" />
                      <ReportedPackage o={r} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <TextInput
                      aria-label={t('mod.rejectReason')}
                      placeholder={t('mod.rejectReason')}
                      maxLength={300}
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      className="h-9 min-w-0 flex-1 text-sm"
                    />
                    {r.status !== 'approved' && (
                      <Button size="sm" variant="primary" disabled={busyId === r.id} onClick={() => act(r.id, 'approve')}>
                        {t('mod.approve')}
                      </Button>
                    )}
                    <Button size="sm" variant="danger" disabled={busyId === r.id} onClick={() => act(r.id, 'reject')}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
