import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ClipboardList, Compass, FlaskConical, Map as MapIcon, PlusCircle, User, UtensilsCrossed } from 'lucide-react';
import { config } from '../config/env';
import { useAuth } from '../auth/AuthProvider';
import { useAppData } from '../data/AppDataProvider';
import { LOCALES, useI18n } from '../i18n/I18nProvider';
import { LocationSelector } from './LocationSelector';
import { cx } from './ui';

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-1.5" aria-label="As3ari — home">
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect width="28" height="28" rx="7" fill="var(--color-brand-600)" />
        <path d="M14 6.5a5.5 5.5 0 0 0-5.5 5.5c0 4 5.5 9.5 5.5 9.5s5.5-5.5 5.5-9.5A5.5 5.5 0 0 0 14 6.5Z" fill="#fff" />
        <text x="14" y="14.6" textAnchor="middle" fontSize="6.6" fontWeight="800" fill="var(--color-brand-700)" fontFamily="Inter, sans-serif">
          DA
        </text>
      </svg>
      <span className="text-[19px] font-extrabold tracking-tight text-ink">
        As<span className="text-brand-600">3</span>ari
      </span>
    </Link>
  );
}

function ProfileMenu() {
  const { t, locale, setLocale } = useI18n();
  const auth = useAuth();
  const { contributions } = useAppData();
  const [open, setOpen] = useState(false);
  // UI hint only — moderation access is enforced by the database.
  const [moderatorId, setModeratorId] = useState<string | null>(null);
  const uid = auth.session?.user.id ?? null;
  const isMod = uid !== null && moderatorId === uid;
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'block w-full px-3 py-2 text-start text-sm hover:bg-canvas';
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.account')}
        className={cx('grid size-9 place-items-center rounded-full border border-line-strong bg-surface text-ink-2 hover:bg-canvas', auth.session && 'border-brand-500 text-brand-700')}
      >
        <User className="size-[18px]" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-[1500] mt-1 w-60 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-float">
          {auth.session ? (
            <>
              <p className="truncate px-3 py-2 text-xs text-muted">{t('auth.signedInAs', { email: auth.email ?? '' })}</p>
              {!auth.emailVerified && <p className="px-3 pb-2 text-xs font-semibold text-warn">{t('auth.unverified')}</p>}
              <Link role="menuitem" to="/me" className={item} onClick={() => setOpen(false)}>
                {t('nav.myReports')}
              </Link>
              {isMod && (
                <Link role="menuitem" to="/moderate" className={item} onClick={() => setOpen(false)}>
                  {t('nav.moderation')}
                </Link>
              )}
              <button
                role="menuitem"
                type="button"
                className={item}
                onClick={async () => {
                  setOpen(false);
                  await auth.signOut();
                  navigate('/');
                }}
              >
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <Link role="menuitem" to="/signin" className={cx(item, 'font-semibold text-brand-700')} onClick={() => setOpen(false)}>
              {t('nav.signIn')}
            </Link>
          )}
          <Link role="menuitem" to="/about" className={item} onClick={() => setOpen(false)}>
            {t('nav.about')}
          </Link>
          <div className="mt-1 border-t border-line px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold text-muted">{t('nav.language')}</p>
            <div className="flex gap-1">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  lang={l.code}
                  onClick={() => setLocale(l.code)}
                  aria-pressed={locale === l.code}
                  className={cx('flex-1 rounded-sm border px-1.5 py-1 text-xs font-semibold', locale === l.code ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-2')}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: '/', key: 'nav.explore', icon: Compass, end: true },
  { to: '/map', key: 'nav.map', icon: MapIcon, end: true },
  { to: '/plan', key: 'nav.plan', icon: UtensilsCrossed, end: false },
  { to: '/lists', key: 'nav.lists', icon: ClipboardList, end: false },
] as const;

function BottomNav() {
  const { t } = useI18n();
  const { search } = useLocation();
  // Explore and Map share the same price context (product/shop query params).
  const carry = (to: string) => (to === '/' || to === '/map' ? `${to}${search}` : to);
  return (
    <nav aria-label="Primary" className="z-[1200] grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {NAV.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={carry(to)}
          end={end}
          className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-muted')}
        >
          <Icon className="size-[22px]" aria-hidden />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

function DesktopNav() {
  const { t } = useI18n();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
      {NAV.filter((n) => n.to !== '/map').map(({ to, key, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cx('rounded-md px-3 py-2 text-sm font-semibold', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-canvas')}
        >
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

export function DemoStrip() {
  const { t } = useI18n();
  if (!config.isDemoMode) return null;
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 bg-demo-bg px-3 py-1 text-center text-xs font-medium text-demo" role="note">
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
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <div className="flex h-dvh flex-col">
      <header className="z-[1300] shrink-0 border-b border-line bg-surface">
        <div className="flex h-14 items-center gap-2 px-3 lg:px-4">
          <Logo />
          <div className="ms-1 min-w-0">
            <LocationSelector compact />
          </div>
          <div className="flex-1" />
          <DesktopNav />
          <Link
            to="/contribute"
            className="hidden h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 lg:inline-flex"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t('nav.report')}
          </Link>
          <ProfileMenu />
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
