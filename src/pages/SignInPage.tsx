import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { safeRedirectPath } from '../auth/safeRedirect';
import { useI18n } from '../i18n/I18nProvider';
import { Button, Field, Notice, PageContainer, TextInput } from '../components/ui';

export default function SignInPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [params] = useSearchParams();
  const next = safeRedirectPath(params.get('next'), '/contribute');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null);

  if (auth.session) return <Navigate to={next} replace />;

  if (!auth.available) {
    return (
      <PageContainer>
        <h1 className="text-2xl font-bold">{t('auth.title')}</h1>
        <div className="mt-4" data-testid="auth-unavailable">
          <Notice tone="demo">{t('auth.unavailable')}</Notice>
        </div>
        <p className="mt-3 text-sm text-ink-2">{t('auth.why')}</p>
      </PageContainer>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'signin') {
      const res = await auth.signInWithPassword(cleanEmail, password);
      if (!res.ok) setMsg({ tone: 'warn', text: res.error || t('auth.failed') });
    } else {
      const res = await auth.signUp(cleanEmail, password, next);
      if (res.ok) {
        if (res.session) {
          // Instantly logged in (e.g. email confirmation disabled)
          return;
        }
        setMsg({ tone: 'good', text: t('auth.signUpSent') });
      } else {
        setMsg({ tone: 'warn', text: res.error || t('auth.signUpFailed') });
      }
    }
    setBusy(false);
  }

  async function magic() {
    if (!email.includes('@')) return;
    setBusy(true);
    const res = await auth.sendMagicLink(email.trim().toLowerCase(), next);
    setMsg(res.ok ? { tone: 'good', text: t('auth.magicLinkSent') } : { tone: 'warn', text: res.error || t('common.error') });
    setBusy(false);
  }

  async function handleResetPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setMsg({ tone: 'warn', text: t('auth.email') });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await auth.resetPassword(cleanEmail);
    setMsg(res.ok ? { tone: 'good', text: t('auth.resetSent') } : { tone: 'warn', text: res.error || t('common.error') });
    setBusy(false);
  }

  return (
    <PageContainer className="max-w-md">
      <h1 className="text-2xl font-bold">{t('auth.title')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('auth.why')}</p>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <Field label={t('auth.email')} htmlFor="email">
          <TextInput id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')} htmlFor="password" hint={mode === 'signup' ? t('auth.passwordHint') : undefined}>
          <TextInput
            id="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 10 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {mode === 'signin' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={busy}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        )}
        {msg && (
          <div role="status">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
        </Button>

        <div className="relative my-2 text-center text-xs text-muted before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-line">
          <span className="relative bg-surface px-2">or</span>
        </div>

        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const res = await auth.signInWithGoogle(next);
            if (!res.ok) {
              setMsg({ tone: 'warn', text: res.error || t('common.error') });
              setBusy(false);
            }
          }}
          disabled={busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-semibold text-ink shadow-xs hover:bg-canvas disabled:opacity-60"
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="block w-full text-center text-sm font-semibold text-brand-700">
          {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>
        <button type="button" onClick={magic} disabled={busy} className="block w-full text-center text-xs text-muted underline">
          {t('auth.magicLink')}
        </button>
      </form>
    </PageContainer>
  );
}
