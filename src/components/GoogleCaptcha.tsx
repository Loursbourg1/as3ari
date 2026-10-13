import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { config } from '../config/env';
import { useI18n } from '../i18n/I18nProvider';

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark';
        },
      ) => number;
      reset: (opt_widget_id?: number) => void;
    };
    __recaptchaLoaded?: () => void;
  }
}

interface GoogleCaptchaProps {
  onVerify: (token: string | null) => void;
  className?: string;
}

export function GoogleCaptcha({ onVerify, className = '' }: GoogleCaptchaProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  const siteKey = config.recaptchaSiteKey;

  useEffect(() => {
    // If no site key is configured (local prototype / dev mode), auto-verify
    if (!siteKey) {
      onVerify('dev-sandbox-token');
      return;
    }

    let active = true;

    function renderWidget() {
      if (!active || !containerRef.current || !window.grecaptcha || widgetIdRef.current !== null) return;
      try {
        const id = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (active) onVerify(token);
          },
          'expired-callback': () => {
            if (active) onVerify(null);
          },
          'error-callback': () => {
            if (active) onVerify(null);
          },
          theme: 'light',
        });
        widgetIdRef.current = id;
        setIsRendered(true);
      } catch {
        // Silently handle re-renders
      }
    }

    if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
      renderWidget();
    } else {
      window.__recaptchaLoaded = () => {
        renderWidget();
      };

      const existingScript = document.getElementById('google-recaptcha-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-recaptcha-script';
        script.src = 'https://www.google.com/recaptcha/api.js?onload=__recaptchaLoaded&render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [siteKey, onVerify]);

  if (!siteKey) {
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

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-bold text-muted uppercase tracking-wider">
        {t('contribute.captcha')}
      </label>
      <div className="flex justify-start overflow-hidden rounded-xl">
        <div ref={containerRef} />
      </div>
      {!isRendered && (
        <p className="text-[11px] text-muted">{t('feed.loading')}</p>
      )}
    </div>
  );
}
