import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-3.5 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-canvas',
        variant === 'ghost' && 'text-ink-2 hover:bg-canvas',
        variant === 'danger' && 'border border-danger/30 bg-danger-bg text-danger hover:bg-danger/10',
        className,
      )}
    />
  );
}

export function Badge({ tone = 'neutral', children, title, className }: { tone?: 'neutral' | 'good' | 'warn' | 'stale' | 'brand' | 'demo' | 'danger'; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap',
        tone === 'neutral' && 'bg-canvas text-ink-2',
        tone === 'good' && 'bg-good-bg text-good',
        tone === 'warn' && 'bg-warn-bg text-warn',
        tone === 'stale' && 'bg-stale-bg text-stale',
        tone === 'brand' && 'bg-brand-50 text-brand-700',
        tone === 'demo' && 'bg-demo-bg text-demo',
        tone === 'danger' && 'bg-danger-bg text-danger',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="w-full max-w-sm animate-pulse space-y-2 p-4" aria-label={label ?? t('common.loading')}>
      <span className="block h-3 w-3/4 rounded-full bg-line" />
      <span className="block h-3 w-1/2 rounded-full bg-line" />
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="m-3 flex items-start gap-2 rounded-md border border-danger/20 bg-danger-bg p-3 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p>{message ?? t('common.error')}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-1 font-semibold underline">
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  );
}

export function Notice({ tone = 'neutral', children, icon }: { tone?: 'neutral' | 'warn' | 'demo' | 'good' | 'brand'; children: ReactNode; icon?: ReactNode }) {
  return (
    <div
      className={cx(
        'flex items-start gap-2 rounded-md px-3 py-2 text-[13px] leading-5',
        tone === 'neutral' && 'bg-canvas text-ink-2',
        tone === 'warn' && 'bg-warn-bg text-warn',
        tone === 'demo' && 'bg-demo-bg text-demo',
        tone === 'good' && 'bg-good-bg text-good',
        tone === 'brand' && 'bg-brand-50 text-brand-800',
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string | null; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

/** Class groups where a caller-provided class must replace the base class (no tailwind-merge dependency). */
const GROUPS = [/^w-/, /^max-w-/, /^min-w-/, /^h-/, /^px-/, /^py-/, /^ps-/, /^pe-/, /^p-/, /^text-(xs|sm|base|lg|xl|\[\d)/];

export function withOverrides(base: string, extra?: string): string {
  if (!extra) return base;
  const extras = extra.split(/\s+/);
  const kept = base.split(/\s+/).filter((b) => !GROUPS.some((g) => g.test(b) && extras.some((e) => g.test(e))));
  return [...kept, ...extras].join(' ');
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={withOverrides(inputCls, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={withOverrides(`${inputCls} pe-8`, props.className)} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-3xl px-4 pb-28 pt-4 lg:pb-10', className)}>{children}</div>;
}
