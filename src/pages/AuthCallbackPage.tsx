import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { safeRedirectPath } from '../auth/safeRedirect';
import { useI18n } from '../i18n/I18nProvider';
import { Spinner } from '../components/ui';

/** Landing page for email confirmation / magic links. supabase-js exchanges the PKCE code automatically. */
export default function AuthCallbackPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeRedirectPath(params.get('next'), '/contribute');

  useEffect(() => {
    if (auth.loading) return;
    const id = setTimeout(() => navigate(auth.session ? next : '/signin', { replace: true }), auth.session ? 0 : 3000);
    return () => clearTimeout(id);
  }, [auth.loading, auth.session, navigate, next]);

  return <Spinner label={t('auth.processing')} />;
}
