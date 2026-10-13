import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n/I18nProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { AppDataProvider } from '../data/AppDataProvider';
import { createDemoRepository } from '../data/demoRepository';
import { ComparisonRowItem } from './ComparisonList';
import { ObservationList } from './ObservationList';
import { escapeHtml } from '../map/PriceMap';
import { CATEGORIES, INGREDIENTS, PRODUCTS } from '../data/reference/catalog';
import { RECIPES } from '../data/reference/recipes';
import { LOCAL_AREAS, WILAYAS } from '../data/reference/geography';
import type { PriceObservation, Shop } from '../domain/types';

const PAYLOAD = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;

const shop: Shop = {
  id: 'd0000000-0000-4000-8000-0000000000aa',
  name: `Evil ${PAYLOAD}`,
  kind: 'shop',
  wilaya_code: 17,
  area_id: null,
  address_text: PAYLOAD,
  lat: 34.67,
  lng: 3.25,
  provenance: 'verified_visit',
  is_demo: false,
};
const obs: PriceObservation = {
  id: 'r1', product_id: 'potatoes', shop_id: shop.id, price: '100.00', quantity: '1', unit: 'kg', normalized_price: '100.00',
  comparison_unit: 'kg', observed_on: '2026-10-10', submitted_at: '2026-10-10T10:00:00Z', source: 'community', is_demo: false, corroborating_reports: 0,
};
const catalog = { categories: CATEGORIES, products: PRODUCTS, ingredients: INGREDIENTS, recipes: RECIPES, wilayas: WILAYAS, areas: LOCAL_AREAS };

function wrap(children: ReactNode) {
  return (
    <MemoryRouter>
      <I18nProvider>
        <AuthProvider>
          <AppDataProvider repository={createDemoRepository('2026-10-11')}>{children}</AppDataProvider>
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('untrusted text is rendered as text', () => {
  it('comparison rows escape shop names', () => {
    const { container } = render(
      wrap(
        <ul>
          <ComparisonRowItem
            row={{ shop, observation: obs, freshness: { state: 'recent', ageDays: 1 }, distanceKm: null, isLowestReported: false, historyCount: 1 }}
            product={PRODUCTS[0]!}
            categories={CATEGORIES}
            areas={LOCAL_AREAS}
            today="2026-10-11"
            selected={false}
            onSelect={() => undefined}
          />
        </ul>,
      ),
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it('observation history escapes shop names', () => {
    const { container } = render(wrap(<ObservationList observations={[obs]} catalog={catalog} today="2026-10-11" shops={new Map([[shop.id, shop]])} show="shop" />));
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });

  it('map marker markup escapes any text it embeds', () => {
    expect(escapeHtml(PAYLOAD)).not.toMatch(/<|>/);
    expect(escapeHtml(`"' &`)).toBe('&quot;&#39; &amp;');
  });
});
