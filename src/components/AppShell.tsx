import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  FlaskConical,
  Info,
  Map,
  Menu,
  PlusCircle,
  Shield,
  Tag,
  TrendingUp,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { config } from '../config/env';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { LOCALES, useI18n } from '../i18n/I18nProvider';
import { LocationSelector } from './LocationSelector';
import { cx } from './ui';

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-1.5" aria-label="As3ari — home">
      <img src="/logo.png" alt="As3ari Logo" className="size-8 object-contain shrink-0" />
      <span className="text-[17px] sm:text-[19px] font-extrabold tracking-tight text-ink hidden min-[360px]:inline">
        As<span className="text-brand-600">3</span>ari
      </span>
    </Link>
  );
}

const NAV = [
  { to: '/', key: 'nav.feed', icon: Tag, end: true },
  { to: '/map', key: 'nav.map', icon: Map, end: true },
  { to: '/trends', key: 'nav.trends', icon: TrendingUp, end: true },
  { to: '/plan', key: 'nav.plan', icon: UtensilsCrossed, end: false },
  { to: '/me', key: 'nav.myReports', icon: User, end: false },
] as const;

/** Pull-out sidebar drawer with secondary navigation, settings & profile */
function SidebarDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const auth = useAuth();
  const { contributions } = useAppData();
  const drawerRef = useRef<HTMLDivElement>(null);

  const [moderatorId, setModeratorId] = useState<string | null>(null);
  const uid = auth.session?.user.id ?? null;
  const isMod = uid !== null && moderatorId === uid;

  useEffect(() => {
    if (!uid) return;
    let active = true;
    contributions.isModerator().then(
      (ok) => active && setModeratorId(ok ? uid : null),
      () => active && setModeratorId(null),
    );
    return () => {
      active = false;
    };
  }, [uid, contributions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 start-0 z-[2010] flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface shadow-2xl animate-in slide-in-from-start duration-200"
      >
        {/* Drawer Header */}
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-2 hover:bg-canvas hover:text-ink"
            aria-label={t('nav.close')}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Location selector strip inside drawer */}
        <div className="border-b border-line bg-canvas/60 px-4 py-2.5">
          <p className="text-[11px] font-semibold text-muted mb-1">
            {t('location.search')}
          </p>
          <LocationSelector compact />
        </div>

        {/* Main Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {NAV.map(({ to, key, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-bold'
                    : 'text-ink-2 hover:bg-canvas hover:text-ink',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span>{t(key)}</span>
            </NavLink>
          ))}

          {/* Prominent contribute button inside drawer as well */}
          <div className="pt-2">
            <Link
              to="/contribute"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-700"
            >
              <PlusCircle className="size-5 shrink-0" aria-hidden />
              <span>{t('nav.report')}</span>
            </Link>
          </div>

          <div className="my-3 border-t border-line" />

          {/* Moderation Link if moderator */}
          {isMod && (
            <NavLink
              to="/moderate"
              onClick={onClose}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-brand-700 font-bold' : 'text-muted hover:bg-canvas hover:text-ink',
                )
              }
            >
              <Shield className="size-4 shrink-0" aria-hidden />
              <span>{t('nav.moderation')}</span>
            </NavLink>
          )}

          {/* About link */}
          <NavLink
            to="/about"
            onClick={onClose}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                isActive ? 'text-brand-700 font-bold' : 'text-muted hover:bg-canvas hover:text-ink',
              )
            }
          >
            <Info className="size-4 shrink-0" aria-hidden />
            <span>{t('nav.about')}</span>
          </NavLink>
        </div>

        {/* Footer: Language + Account */}
        <div className="border-t border-line bg-canvas p-4 space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">{t('nav.language')}</p>
            <div className="flex gap-1">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  lang={l.code}
                  onClick={() => setLocale(l.code)}
                  aria-pressed={locale === l.code}
                  className={cx(
                    'flex-1 rounded-lg border px-2 py-1 text-xs font-semibold',
                    locale === l.code
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-bold'
                      : 'border-line bg-surface text-ink-2 hover:bg-canvas',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {auth.session ? (
            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span className="truncate max-w-[150px]">{auth.email}</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  auth.signOut();
                }}
                className="font-semibold text-danger hover:underline"
              >
                {t('nav.signOut')}
              </button>
            </div>
          ) : (
            <Link
              to="/signin"
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-lg border border-line-strong bg-surface py-1.5 text-xs font-bold text-ink hover:bg-canvas"
            >
              {t('nav.signIn')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function BottomNav() {
  const { t } = useI18n();
  return (
    <nav
      aria-label="Primary"
      className="z-[1200] grid shrink-0 grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cx(
              'flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold',
              isActive ? 'text-brand-700 font-bold' : 'text-muted',
            )
          }
        >
          <Icon className="size-[20px]" aria-hidden />
          <span className="truncate max-w-[64px]">{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function DemoStrip() {
  const { t } = useI18n();
  if (!config.isDemoMode) return null;
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-1.5 bg-demo-bg px-3 py-1 text-center text-xs font-medium text-demo"
      role="note"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>{t('demo.banner')}</span>
      <Link to="/about#demo" className="shrink-0 font-semibold underline">
        {t('demo.learnMore')}
      </Link>
    </div>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col">
      {/* Sidebar Drawer */}
      <SidebarDrawer isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header className="z-[1300] shrink-0 border-b border-line bg-surface">
        <div className="flex h-14 items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            {/* Hamburger button to pull sidebar */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-canvas"
              aria-label={t('nav.menu')}
            >
              <Menu className="size-5" />
            </button>

            <Logo />

            {/* Location selector - smoothly constrained and responsive */}
            <div className="min-w-0 flex-1 sm:flex-initial">
              <LocationSelector compact />
            </div>
          </div>

          {/* Primary prominent CTA on top right: Report Price */}
          <Link
            to="/contribute"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-2.5 sm:px-3.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-brand-700 active:scale-95 transition-all"
          >
            <PlusCircle className="size-4 shrink-0" aria-hidden />
            <span>{t('nav.report')}</span>
          </Link>
        </div>
      </header>
      <DemoStrip />
      <main id="main" ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
