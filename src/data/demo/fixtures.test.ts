import { describe, expect, it } from 'vitest';
import { Big } from '../../domain/money';
import { PRODUCTS } from '../reference/catalog';
import { DEMO_SHOPS, demoObservationDefs, demoObservations } from './fixtures';
import { categoryImageUrl } from './photos';

describe('demo fixtures', () => {
  it('uses distinct Font Awesome vectors for each food category', () => {
    const categories = ['vegetables', 'meat-poultry', 'fish', 'dairy-eggs', 'grains-legumes', 'bakery', 'pantry', 'desserts', 'drinks'];
    const icons = categories.map((category) => categoryImageUrl(category));
    expect(new Set(icons).size).toBe(categories.length);
    const svg = decodeURIComponent(icons[0]!.split(',')[1]!);
    expect(svg).toContain('viewBox="0 0 128 128"');
    expect(svg).toContain('fill="#174c30" transform="translate(');
  });

  it('are deterministic', () => {
    expect(demoObservationDefs()).toEqual(demoObservationDefs());
  });
  it('are always labelled as demo data', () => {
    expect(DEMO_SHOPS.every((s) => s.is_demo && s.provenance === 'demo' && s.name.startsWith('Demo'))).toBe(true);
    expect(demoObservations('2026-10-11').every((o) => o.is_demo && o.source === 'demo' && o.corroborating_reports === 0)).toBe(true);
  });
  it('includes demo observations for dessert and drink products', () => {
    const productIds = new Set(demoObservationDefs().map((observation) => observation.product_id));
    expect([...productIds]).toEqual(expect.arrayContaining(['baklava', 'orange-juice', 'water']));
  });
  it('stay within the plausibility bounds the server enforces', () => {
    for (const o of demoObservations('2026-10-11')) {
      const p = PRODUCTS.find((x) => x.id === o.product_id)!;
      const v = new Big(o.normalized_price!);
      expect(v.gte(p.min_unit_price) && v.lte(p.max_unit_price), `${o.product_id} ${o.normalized_price}`).toBe(true);
    }
  });
  it('include history and stale examples', () => {
    const obs = demoObservations('2026-10-11');
    expect(obs.some((o) => o.observed_on < '2026-09-01')).toBe(true);
    expect(new Set(obs.map((o) => o.shop_id)).size).toBe(DEMO_SHOPS.length);
  });
});
