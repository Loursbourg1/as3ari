import { useCallback, useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { config } from '../config/env';
import { useI18n } from '../i18n/I18nProvider';

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (fn: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
      ready?: (fn: () => void) => void;
      execute?: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface GoogleCaptchaProps {
  /** Called with a fresh v3 token, or null if something went wrong. */
  onVerify: (token: string | null) => void;
  /** Action name passed to reCAPTCHA v3 — used for analytics in Google console. */
  action?: string;
  className?: string;
}

/**
 * reCAPTCHA v3 — invisible, score-based.
 * Loads the script once per page and exposes `execute()` on the window.
 * The parent component calls `onVerify` with a fresh token just before form submission.
 *
 * If no site key is configured the component auto-verifies with a sandbox token
 * so the form is never blocked during local development or demo mode.
 */
export function GoogleCaptcha({ onVerify, action = 'submit_report', className = '' }: GoogleCaptchaProps) {
  const { t } = useI18n();
  const siteKey = config.recaptchaSiteKey;
  const scriptLoadedRef = useRef(false);

  /** Load the reCAPTCHA v3 script once. */
  useEffect(() => {
    if (!siteKey || scriptLoadedRef.current) return;
    if (document.getElementById('google-recaptcha-v3-script')) {
      scriptLoadedRef.current = true;
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-recaptcha-v3-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    scriptLoadedRef.current = true;
  }, [siteKey]);

  /**
   * Execute reCAPTCHA and pass the token to onVerify.
   * Called by the parent just before submitting the form.
   */
  const execute = useCallback((): Promise<string | null> => {
    if (!siteKey) {
      onVerify('dev-sandbox-token');
      return Promise.resolve('dev-sandbox-token');
    }
    return new Promise((resolve) => {
      const run = () => {
        const gr = window.grecaptcha;
        const api = gr?.enterprise ?? gr;
        if (!api?.execute) {
          onVerify(null);
          resolve(null);
          return;
        }
        api
          .execute(siteKey, { action })
          .then((token) => {
            onVerify(token);
            resolve(token);
          })
          .catch(() => {
            onVerify(null);
            resolve(null);
          });
      };

      const gr = window.grecaptcha;
      const api = gr?.enterprise ?? gr;
      if (api?.ready) {
        api.ready(run);
      } else {
        // Script not yet ready — wait up to 5 s
        let waited = 0;
        const interval = setInterval(() => {
          waited += 100;
          const g = window.grecaptcha;
          const a = g?.enterprise ?? g;
          if (a?.ready) {
            clearInterval(interval);
            a.ready(run);
          } else if (waited >= 5000) {
            clearInterval(interval);
            onVerify(null);
            resolve(null);
          }
        }, 100);
      }
    });
  }, [siteKey, action, onVerify]);

  // Expose the execute function on a DOM element so the parent form can trigger it
  // via a data attribute hook — but simpler: auto-execute immediately on mount
  // so the token is ready when the user hits Submit.
  useEffect(() => {
    if (!siteKey) {
      onVerify('dev-sandbox-token');
      return;
    }
    // Pre-warm: execute on mount so a fresh token is ready
    const timer = setTimeout(() => execute(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // v3 is invisible — render a small trust badge only (no checkbox widget)
  return (
    <div className={`flex items-center gap-2 rounded-2xl border border-line bg-canvas/60 px-3.5 py-2.5 text-xs text-ink-2 ${className}`}>
      <ShieldCheck className="size-4 text-brand-600 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-bold text-ink">{t('contribute.captcha')}</p>
        <p className="text-[11px] text-muted">{t('contribute.captcha.verified')}</p>
      </div>
    </div>
  );
}
