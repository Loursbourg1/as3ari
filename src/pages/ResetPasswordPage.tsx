import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { Button, Field, Notice, PageContainer, TextInput } from '../components/ui';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setMsg({ tone: 'warn', text: t('auth.passwordHint') });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await auth.updatePassword(password);
    if (res.ok) {
      setMsg({ tone: 'good', text: t('auth.passwordUpdated') });
      setTimeout(() => navigate('/me', { replace: true }), 1500);
    } else {
      setMsg({ tone: 'warn', text: res.error || t('common.error') });
    }
    setBusy(false);
  }

  return (
    <PageContainer className="max-w-md">
      <h1 className="text-2xl font-bold text-ink">{t('auth.setNewPassword')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('auth.passwordHint')}</p>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <Field label={t('auth.newPassword')} htmlFor="new-password">
          <TextInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {msg && (
          <div role="status">
            <Notice tone={msg.tone}>{msg.text}</Notice>
          </div>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {t('auth.updatePassword')}
        </Button>
      </form>
    </PageContainer>
  );
}
