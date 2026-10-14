import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react';
import { normalizeText } from '../domain/search';
import { useAppData } from '../data/AppDataProvider';
import { useI18n } from '../i18n/I18nProvider';
import { cx } from './ui';

export function LocationSelector({ compact = false }: { compact?: boolean }) {
  const { t, name } = useI18n();
  const { catalog, wilaya, wilayaCode, setWilayaCode, setOrigin } = useAppData();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const list = useMemo(() => {
    const all = [...(catalog.data?.wilayas ?? [])].sort((a, b) => a.code - b.code);
    const nq = normalizeText(q);
    return nq ? all.filter((w) => [w.name_en, w.name_fr, w.name_ar, String(w.code)].some((s) => normalizeText(s).includes(nq))) : all;
  }, [catalog.data, q]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setQ('');
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${t('location.label')}: ${wilaya ? name(wilaya) : wilayaCode}`}
        className={cx(
          'inline-flex min-w-0 max-w-full items-center gap-1 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs sm:text-sm font-bold text-ink hover:bg-canvas border border-line/60 sm:border-transparent transition-colors',
          compact ? 'max-w-[85px] xs:max-w-[125px] sm:max-w-[160px]' : 'max-w-full',
        )}
      >
        <MapPin className="size-3.5 sm:size-4 shrink-0 text-brand-600" aria-hidden />
        <span className="truncate min-w-0">{wilaya ? name(wilaya) : '…'}</span>
        <ChevronDown className="size-3 sm:size-3.5 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/40 sm:items-center" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('location.choose')}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-lg bg-surface shadow-float sm:rounded-lg"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-bold">{t('location.choose')}</h2>
              <button type="button" onClick={close} aria-label={t('common.close')} className="grid size-8 place-items-center rounded-full hover:bg-canvas">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="p-3">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('location.search')}
                aria-label={t('location.search')}
                className="h-10 w-full rounded-md border border-line-strong px-3 text-[15px] focus:border-brand-500 focus:outline-none"
              />
            </div>
            <ul className="flex-1 overflow-auto pb-3">
              {list.map((w) => (
                <li key={w.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setWilayaCode(w.code);
                      setOrigin(null);
                      close();
                    }}
                    aria-current={w.code === wilayaCode}
                    className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-start text-[15px] hover:bg-canvas', w.code === wilayaCode && 'bg-brand-50')}
                  >
                    <span className="num w-7 text-xs font-semibold text-muted">{String(w.code).padStart(2, '0')}</span>
                    <span className="flex-1 font-medium">{name(w)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
