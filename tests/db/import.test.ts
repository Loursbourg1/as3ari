import { describe, expect, it } from 'vitest';
import { ANON, as, createTestDb } from './harness';
import { ImportError, parseCsv, pricesSql, shopsSql } from '../../scripts/import-csv';

const SHOPS = `name,kind,wilaya_code,area_id,address_text,lat,lng,provenance,provenance_note
"Marché ""Test"", centre",market,17,djelfa,Rue X,34.671,3.251,verified_visit,visited by founder 2026-10-10
`;
const PRICES = `product_id,shop_name,wilaya_code,price,quantity,unit,observed_on,provenance_note
potatoes,"Marché ""Test"", centre",17,180,2,kg,2026-10-10,founder field survey
eggs,"Marché ""Test"", centre",17,660,30,piece,2026-10-10,founder field survey
`;

describe('CSV import', () => {
  it('generates SQL that loads genuine, non-demo, approved observations with server-side normalization', async () => {
    const db = await createTestDb({ demo: false });
    await db.exec(shopsSql(parseCsv(SHOPS)));
    await db.exec(pricesSql(parseCsv(PRICES)));
    const rows = await as(db, ANON, () =>
      db.query<{ product_id: string; normalized_price: string; is_demo: boolean; source: string }>(
        `select product_id, normalized_price::text, is_demo, source from public.public_price_observations order by product_id`,
      ),
    );
    expect(rows.rows).toEqual([
      { product_id: 'eggs', normalized_price: '22.00', is_demo: false, source: 'import' },
      { product_id: 'potatoes', normalized_price: '90.00', is_demo: false, source: 'import' },
    ]);
  });

  it('refuses demo provenance, unknown products and implausible prices', () => {
    expect(() => shopsSql(parseCsv(SHOPS.replace('verified_visit', 'demo')))).toThrow(ImportError);
    expect(() => pricesSql(parseCsv(PRICES.replace('potatoes', 'caviar')))).toThrow(ImportError);
    expect(() => pricesSql(parseCsv(PRICES.replace(',180,2,kg', ',99999,1,kg')))).toThrow(/implausible/);
  });
});
