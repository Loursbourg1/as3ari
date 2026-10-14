import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { freshnessOf, thresholdsFor } from '../domain/freshness';
import type { Catalog, PriceObservation, Shop } from '../domain/types';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { CorroboratedBadge, DemoBadge, FreshnessBadge, ObservedDate, ReportedPackage, UnitPrice } from './PriceBits';
import { FlagButton } from './FlagButton';

interface StoredComment {
  id: string;
  author: string;
  anonymous: boolean;
  text: string;
  createdAt: string;
}

function ReportComments({ reportId }: { reportId: string }) {
  const navigate = useNavigate();
  const { session, username } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [comments, setComments] = useState<StoredComment[]>(() => {
    try {
      const raw = window.localStorage.getItem(`as3ari.report-comments.${reportId}`) ?? '[]';
      const parsed = JSON.parse(raw) as StoredComment[];
      if (Array.isArray(parsed)) return parsed.slice(0, 20);
    } catch {
      // Ignore malformed or unavailable local storage.
    }
    return [];
  });

  const saveComments = (next: StoredComment[]) => {
    setComments(next);
    try {
      window.localStorage.setItem(`as3ari.report-comments.${reportId}`, JSON.stringify(next.slice(0, 20)));
    } catch {
      // Ignore storage failures; the comment box still works for the current session.
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!session) {
      navigate(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const next: StoredComment = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      author: anonymous ? 'Anonymous' : (username ?? 'User'),
      anonymous,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    saveComments([next, ...comments]);
    setText('');
    setAnonymous(true);
  };

  return (
    <div className="mt-2 rounded-xl border border-line bg-canvas/40 p-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs font-semibold text-brand-700"
      >
        {open ? 'Hide comments' : `Comments${comments.length ? ` (${comments.length})` : ''}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-muted">No comments yet.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg border border-line bg-surface p-2 text-xs text-ink-2">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="font-semibold text-ink">{comment.anonymous ? 'Anonymous' : comment.author}</strong>
                    <span className="text-[10px] text-muted">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{comment.text}</p>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={submit} className="space-y-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 300))}
              rows={3}
              placeholder={session ? 'Add a comment...' : 'Sign in to add a comment'}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-ink focus:border-brand-500"
            />
            {session && (
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                Post anonymously
              </label>
            )}
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {session ? 'Post comment' : 'Sign in to comment'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** A plain, dated list of individual observations (history). Never aggregated or smoothed. */
export function ObservationList({
  observations,
  catalog,
  today,
  shops,
  show,
}: {
  observations: PriceObservation[];
  catalog: Catalog;
  today: string;
  shops?: Map<string, Shop>;
  show: 'product' | 'shop';
}) {
  const { name, variant } = useI18n();
  return (
    <ul className="divide-y divide-line">
      {observations.map((o) => {
        const product = catalog.products.find((p) => p.id === o.product_id);
        const t = thresholdsFor(product?.category_id, catalog.categories);
        const f = freshnessOf(o.observed_on, today, t);
        const shop = shops?.get(o.shop_id);
        return (
          <li key={o.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5" data-testid="observation">
            <div className="min-w-0 flex-1">
              {show === 'product' && product ? (
                <Link to={`/product/${product.id}`} className="text-sm font-semibold text-ink hover:underline">
                  {name(product)}
                  {variant(product) && <span className="font-normal text-muted"> · {variant(product)}</span>}
                </Link>
              ) : (
                shop && (
                  <Link to={`/shop/${shop.id}`} className="text-sm font-semibold text-ink hover:underline">
                    {shop.name}
                  </Link>
                )
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <ObservedDate date={o.observed_on} today={today} />
                <FreshnessBadge f={f} recentDays={t.recent_days} />
                {o.is_demo && <DemoBadge />}
                <CorroboratedBadge n={o.corroborating_reports} />
              </div>
            </div>
            <div className="flex flex-col items-end text-end">
              <UnitPrice value={o.normalized_price} unit={o.comparison_unit} size="md" />
              <ReportedPackage o={o} />
            </div>
            <div className="basis-full space-y-2">
              <FlagButton reportId={o.id} isDemo={o.is_demo} />
              <ReportComments reportId={o.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
