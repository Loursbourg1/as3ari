import { useI18n } from '../i18n/I18nProvider';
import { PageContainer } from '../components/ui';

const SECTIONS = [
  { title: 'terms.section1Title', body: 'terms.section1Body' },
  { title: 'terms.section2Title', body: 'terms.section2Body' },
  { title: 'terms.section3Title', body: 'terms.section3Body' },
  { title: 'terms.section4Title', body: 'terms.section4Body' },
  { title: 'terms.section5Title', body: 'terms.section5Body' },
  { title: 'terms.section6Title', body: 'terms.section6Body' },
  { title: 'terms.section7Title', body: 'terms.section7Body' },
  { title: 'terms.section8Title', body: 'terms.section8Body' },
] as const;

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <PageContainer className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">{t('terms.title')}</h1>
      <p className="mt-1 text-xs text-muted">{t('terms.lastUpdated')}</p>
      <p className="mt-4 text-sm text-ink-2 leading-relaxed">{t('terms.intro')}</p>
      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-base font-bold text-ink">{t(s.title)}</h2>
            <p className="mt-1 text-sm text-ink-2 leading-relaxed">{t(s.body)}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted border-t border-line pt-4">{t('terms.contact')}</p>
    </PageContainer>
  );
}
