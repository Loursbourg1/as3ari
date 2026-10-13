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
