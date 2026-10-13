import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Flag } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { ApiError } from '../data/repository';
import type { FlagInput } from '../domain/reportSchema';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { Button, Select } from './ui';

const REASONS: FlagInput['reason'][] = ['wrong_price', 'wrong_shop', 'wrong_product', 'duplicate', 'spam', 'other'];

export function FlagButton({ reportId, isDemo }: { reportId: string; isDemo: boolean }) {
  const { t } = useI18n();
  const auth = useAuth();
  const { contributions } = useAppData();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagInput['reason']>('wrong_price');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | { error: string }>('idle');

  if (isDemo || !auth.available) return null;
  if (state === 'done') return <span className="text-xs text-good">{t('flag.done')}</span>;
  if (!auth.session) {
    return (
      <Link to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} className="inline-flex items-center gap-1 text-xs text-muted underline" title={t('flag.signIn')}>
        <Flag className="size-3" aria-hidden />
        {t('flag.action')}
      </Link>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted underline">
        <Flag className="size-3" aria-hidden />
        {t('flag.action')}
      </button>
    );
  }
  return (
    <form
      className="mt-2 w-full space-y-2 rounded-md border border-line bg-canvas p-2"
      aria-label={t('flag.title')}
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        try {
          await contributions.flagReport({ report_id: reportId, reason, note: note.trim() || undefined });
          setState('done');
        } catch (err) {
          setState({ error: err instanceof ApiError ? err.code : 'server_error' });
        }
      }}
    >
      <Select aria-label={t('flag.reason')} value={reason} onChange={(e) => setReason(e.target.value as FlagInput['reason'])} className="h-9 text-sm">
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`flag.reason.${r}`)}
          </option>
        ))}
      </Select>
      <textarea
        aria-label={t('flag.note')}
        placeholder={`${t('flag.note')} (${t('common.optional')})`}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-md border border-line-strong bg-surface p-2 text-sm"
        rows={2}
      />
      {typeof state === 'object' && <p className="text-xs text-danger">{t(`errors.${state.error}` as MessageKey)}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={state === 'sending'}>
          {t('flag.submit')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
