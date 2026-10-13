import { useAppData } from '../data/AppDataProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageContainer } from '../components/ui';

export default function AboutPage() {
  const { t, name } = useI18n();
  const { catalog } = useAppData();
  const h2 = 'mt-6 text-lg font-bold text-ink';
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">{t('about.title')}</h1>
      <div className="mt-3 space-y-3 text-[15px] leading-6 text-ink-2">
        <p>{t('about.what')}</p>
        <p>{t('about.observations')}</p>
        <p>{t('about.moderation')}</p>
        <p>{t('about.comparison')}</p>
      </div>

      <h2 className={h2}>{t('about.freshness')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('about.freshnessBody')}</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-start text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 text-start">{t('about.category')}</th>
              <th className="px-3 py-2 text-start">{t('about.recentUpTo')}</th>
              <th className="px-3 py-2 text-start">{t('about.staleAfter')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {catalog.data?.categories.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{name(c)}</td>
                <td className="num px-3 py-2">{t('about.days', { n: c.recent_days })}</td>
                <td className="num px-3 py-2">{t('about.days', { n: c.stale_days })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="demo" className={h2}>
        {t('about.demo')}
      </h2>
      <p className="mt-1 text-[15px] leading-6 text-ink-2">{t('about.demoBody')}</p>

      <h2 className={h2}>{t('about.privacy')}</h2>
      <p className="mt-1 text-[15px] leading-6 text-ink-2">{t('about.privacyBody')}</p>
    </PageContainer>
  );
}
