import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { searchProducts } from '../domain/search';
import type { Catalog, Product } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { cx } from './ui';

interface Props {
  catalog: Catalog | undefined;
  initialQuery?: string;
  /** Called with the chosen product and the full list of matches for the query. */
  onSelect: (product: Product, query: string, matches: Product[]) => void;
  onClear?: () => void;
  className?: string;
}

/** Accessible combobox over the database-backed product catalogue. */
export function SearchBox({ catalog, initialQuery = '', onSelect, onClear, className }: Props) {
  const { t, name, variant } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => (catalog ? searchProducts(catalog.products, catalog.categories, query, 8).map((m) => m.product) : []),
    [catalog, query],
  );

  function choose(p: Product) {
    setOpen(false);
    setQuery(name(p));
    onSelect(p, query, matches);
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = matches[active] ?? matches[0];
      if (p) choose(p);
      else setOpen(true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length > 0;

  return (
    <div className={cx('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t('search.label')}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
          placeholder={t('search.placeholder')}
          value={query}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-md border border-line-strong bg-surface ps-10 pe-10 text-[15px] text-ink shadow-card placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label={t('search.clear')}
            onClick={() => {
              setQuery('');
              setOpen(false);
              onClear?.();
              inputRef.current?.focus();
            }}
            className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-canvas"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('search.suggestions')}
          className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-80 overflow-auto rounded-md border border-line bg-surface py-1 shadow-float"
        >
          {matches.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">{t('search.noResults', { q: query.trim() })}</li>}
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
              className={cx('flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-[15px]', i === active && 'bg-brand-50')}
            >
              <span className="font-medium text-ink">{name(p)}</span>
              {variant(p) && <span className="truncate text-xs text-muted">{variant(p)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
