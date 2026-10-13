/**
 * Access-control and integrity tests run against the REAL migrations in an
 * in-process PostgreSQL (PGlite), as anon, ordinary users, other users and admins.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { ANON, as, createRealShop, createTestDb, createUser, rejects, user } from './harness';
import { normalizeUnitPrice } from '../../src/domain/units';

let db: PGlite;
let today: string;
let shopId: string;
let alice: string; // verified contributor
let bob: string; // verified, other user
let carol: string; // unverified
let admin: string;

const submit = (uid: string, args: Partial<{ product: string; shop: string; price: string; qty: string; unit: string; date: string }> = {}) =>
  as(db, user(uid), () =>
    db.query<{ id: string; status: string; normalized_price: string; comparison_unit: string }>(
      `select * from public.submit_price_report($1, $2::uuid, $3::numeric, $4::numeric, $5::public.unit_code, $6::date)`,
      [args.product ?? 'potatoes', args.shop ?? shopId, args.price ?? '180', args.qty ?? '2', args.unit ?? 'kg', args.date ?? today],
    ),
  );

beforeAll(async () => {
  db = await createTestDb();
  today = (await db.query<{ d: string }>(`select public.today_algeria()::text as d`)).rows[0]!.d;
  shopId = await createRealShop(db);
  alice = await createUser(db);
  bob = await createUser(db);
  carol = await createUser(db, { verified: false });
  admin = await createUser(db, { role: 'admin' });
});

describe('harness sanity', () => {
  it('really switches database role and JWT subject', async () => {
    const a = await as(db, ANON, () => db.query<{ u: string; uid: string | null }>(`select current_user as u, auth.uid() as uid`));
    expect(a.rows[0]).toEqual({ u: 'anon', uid: null });
    const b = await as(db, user(alice), () => db.query<{ u: string; uid: string }>(`select current_user as u, auth.uid() as uid`));
    expect(b.rows[0]).toEqual({ u: 'authenticated', uid: alice });
    await rejects(Promise.resolve(1), 'x').then(
      () => { throw new Error('rejects() must fail when the promise resolves'); },
      (e: Error) => expect(e.message).toContain('succeeded'),
    );
  });
});

describe('anonymous visitors', () => {
  it('can read reference data and approved public observations', async () => {
    await as(db, ANON, async () => {
      expect((await db.query(`select * from public.products`)).rows.length).toBeGreaterThan(10);
      expect((await db.query(`select * from public.shops`)).rows.length).toBeGreaterThan(0);
      const obs = await db.query(`select * from public.public_price_observations`);
      expect(obs.rows.length).toBeGreaterThan(0);
      expect(Object.keys(obs.rows[0] as object)).not.toContain('contributor_id');
    });
  });
  it('cannot read the raw price_reports table', async () => {
    await as(db, ANON, () => rejects(db.query(`select * from public.price_reports`), 'permission denied'));
  });
  it('cannot submit reports', async () => {
    await as(db, ANON, () =>
      rejects(db.query(`select * from public.submit_price_report('potatoes', $1::uuid, 100, 1, 'kg', current_date)`, [shopId]), 'permission denied'),
    );
    await as(db, ANON, () =>
      rejects(db.query(`insert into public.price_reports (product_id, shop_id, price, quantity, unit, comparison_unit, observed_on) values ('potatoes', $1, 1, 1, 'kg', 'kg', current_date)`, [shopId]), 'permission denied'),
    );
  });
  it('cannot write reference data', async () => {
    await as(db, ANON, () => rejects(db.query(`update public.products set name_en = 'x'`), 'permission denied'));
    await as(db, ANON, () => rejects(db.query(`insert into public.shops (name, kind, wilaya_code, lat, lng, provenance) values ('x', 'shop', 17, 34.6, 3.2, 'verified_visit')`), 'permission denied'));
  });
  it('cannot read profiles, roles, flags or private plans', async () => {
    for (const t of ['profiles', 'user_roles', 'report_flags', 'moderation_events', 'meal_plans', 'saved_lists']) {
      await as(db, ANON, () => rejects(db.query(`select * from public.${t}`), 'permission denied'));
    }
  });
});

describe('contribution', () => {
  it('requires a verified email', async () => {
    await rejects(submit(carol), 'email_not_verified');
  });

  it('accepts a valid report as pending and normalizes price server-side', async () => {
    const r = await submit(alice);
    expect(r.rows[0]!.status).toBe('pending');
    expect(Number(r.rows[0]!.normalized_price)).toBe(90);
    expect(r.rows[0]!.comparison_unit).toBe('kg');
    const mine = await as(db, user(alice), () => db.query<{ status: string }>(`select * from public.my_price_reports()`));
    expect(mine.rows.map((x) => x.status)).toContain('pending');
  });

  it('SQL normalization matches the TypeScript implementation', async () => {
    const cases: [string, string, 'g' | 'kg' | 'ml' | 'l' | 'piece'][] = [
      ['180', '2', 'kg'], ['90', '500', 'g'], ['65', '250', 'ml'], ['660', '30', 'piece'], ['100', '3', 'kg'], ['0.05', '2', 'kg'], ['1300', '5', 'l'],
    ];
    for (const [p, q, u] of cases) {
      const r = await db.query<{ normalized_price: string }>(`select normalized_price::text from public.normalize_price($1::numeric, $2::numeric, $3::public.unit_code)`, [p, q, u]);
      const ts = normalizeUnitPrice(p, q, u);
      expect(ts.ok && ts.value).toBe(Number(r.rows[0]!.normalized_price).toFixed(2));
    }
  });

  it('pending reports never leak through public queries', async () => {
    const pending = await submit(alice, { product: 'onions', price: '70', qty: '1' });
    const id = pending.rows[0]!.id;
    for (const actor of [ANON, user(bob), user(alice)]) {
      const r = await as(db, actor, () => db.query(`select 1 from public.public_price_observations where id = $1`, [id]));
      expect(r.rows).toHaveLength(0);
    }
  });

  it('rejects invalid prices, quantities, units, dates, products and shops', async () => {
    await rejects(submit(alice, { product: 'carrots', price: '0' }), 'invalid_price');
    await rejects(submit(alice, { product: 'carrots', price: '-5' }), 'invalid_price');
    await rejects(submit(alice, { product: 'carrots', price: '10.555' }), 'invalid_price');
    await rejects(submit(alice, { product: 'carrots', qty: '0' }), 'invalid_quantity');
    await rejects(submit(alice, { product: 'carrots', qty: '500', unit: 'kg' }), 'invalid_quantity');
    await rejects(submit(alice, { product: 'eggs', qty: '1.5', unit: 'piece', price: '33' }), 'invalid_quantity');
    await rejects(submit(alice, { product: 'eggs', unit: 'kg' }), 'unit_mismatch');
    await rejects(submit(alice, { product: 'carrots', date: '2099-01-01' }), 'invalid_date');
    await rejects(submit(alice, { product: 'carrots', date: '2020-01-01' }), 'invalid_date');
    await rejects(submit(alice, { product: 'caviar' }), 'unknown_product');
    await rejects(submit(alice, { shop: '00000000-0000-4000-8000-000000000000' }), 'unknown_shop');
    await rejects(submit(alice, { shop: 'd0000000-0000-4000-8000-000000000001' }), 'unknown_shop'); // demo shop
    await rejects(submit(alice, { product: 'carrots', price: '100000', qty: '1' }), 'implausible_price');
    await rejects(submit(alice, { product: 'carrots', price: '1', qty: '1' }), 'implausible_price');
  });

  it('detects duplicates', async () => {
    await submit(bob, { product: 'garlic', price: '900', qty: '1' });
    await rejects(submit(bob, { product: 'garlic', price: '950', qty: '1' }), 'duplicate_report');
  });

  it('enforces rate limits in the database', async () => {
    const spammer = await createUser(db);
    const products = ['potatoes', 'onions', 'tomatoes', 'carrots', 'zucchini', 'green-peppers', 'garlic', 'lentils', 'chickpeas', 'white-beans', 'rice'];
    const prices: Record<string, string> = { garlic: '900', lentils: '280', chickpeas: '380', 'white-beans': '350', rice: '220' };
    for (const p of products.slice(0, 10)) await submit(spammer, { product: p, price: prices[p] ?? '100', qty: '1' });
    await rejects(submit(spammer, { product: products[10], price: '220', qty: '1' }), 'rate_limited');
  });
});

describe('ordinary users cannot escalate', () => {
  it('cannot read or modify raw reports or change moderation state', async () => {
    await as(db, user(alice), async () => {
      await rejects(db.query(`select * from public.price_reports`), 'permission denied');
      await rejects(db.query(`update public.price_reports set status = 'approved'`), 'permission denied');
      await rejects(db.query(`delete from public.price_reports`), 'permission denied');
      await rejects(db.query(`insert into public.price_reports (product_id, shop_id, contributor_id, price, quantity, unit, comparison_unit, normalized_price, observed_on, status) values ('potatoes', $1, $2, 1, 1, 'kg', 'kg', 1, current_date, 'approved')`, [shopId, alice]), 'permission denied');
    });
  });

  it('cannot moderate or view the moderation queue', async () => {
    const r = await submit(alice, { product: 'tomatoes', price: '120', qty: '1' });
    await as(db, user(alice), async () => {
      await rejects(db.query(`select public.moderate_price_report($1, 'approve')`, [r.rows[0]!.id]), 'not_allowed');
      await rejects(db.query(`select * from public.moderation_queue()`), 'not_allowed');
    });
  });

  it('cannot grant themselves roles', async () => {
    await as(db, user(alice), async () => {
      await rejects(db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [alice]), 'permission denied');
      expect((await db.query(`select public.is_admin() as a`)).rows[0]).toEqual({ a: false });
    });
  });

  it('treats the operator email as admin and moderator without a prior user_roles row', async () => {
    const id = randomUUID();
    await db.exec('reset role');
    await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, 'lilredheadfan@gmail.com']);
    const flags = await as(db, user(id), () =>
      db.query<{ admin: boolean; mod: boolean }>(`select public.is_admin() as admin, public.is_moderator() as mod`),
    );
    expect(flags.rows[0]).toEqual({ admin: true, mod: true });
  });

  it('cannot alter trusted shop coordinates or product identities', async () => {
    const before = await db.query<{ lat: string }>(`select lat::text from public.shops where id = $1`, [shopId]);
    await as(db, user(alice), async () => {
      const u = await db.query(`update public.shops set lat = 35 where id = $1`, [shopId]);
      expect(u.affectedRows ?? 0).toBe(0);
      const p = await db.query(`update public.products set dimension = 'count' where id = 'potatoes'`);
      expect(p.affectedRows ?? 0).toBe(0);
      await rejects(db.query(`insert into public.products (id, category_id, name_en, name_fr, name_ar, dimension, min_unit_price, max_unit_price) values ('fake', 'vegetables', 'f', 'f', 'f', 'mass', 1, 2)`), 'row-level security');
    });
    const after = await db.query<{ lat: string }>(`select lat::text from public.shops where id = $1`, [shopId]);
    expect(after.rows[0]!.lat).toBe(before.rows[0]!.lat);
  });

  it("cannot read another user's reports or profile", async () => {
    const bobs = await as(db, user(bob), () => db.query<{ id: string }>(`select id from public.my_price_reports()`));
    const alices = await as(db, user(alice), () => db.query<{ id: string }>(`select id from public.my_price_reports()`));
    const overlap = bobs.rows.filter((b) => alices.rows.some((a) => a.id === b.id));
    expect(overlap).toHaveLength(0);
    await as(db, user(alice), async () => {
      const r = await db.query(`select * from public.profiles where id = $1`, [bob]);
      expect(r.rows).toHaveLength(0);
      const own = await db.query(`select * from public.profiles where id = $1`, [alice]);
      expect(own.rows).toHaveLength(1);
      const upd = await db.query(`update public.profiles set display_name = 'hacked' where id = $1`, [bob]);
      expect(upd.affectedRows ?? 0).toBe(0);
    });
  });

  it("cannot read or modify another user's private meal plans and lists", async () => {
    const plan = await as(db, user(alice), () =>
      db.query<{ id: string }>(`insert into public.meal_plans (household_size, budget_dzd) values (4, 12000) returning id`),
    );
    const planId = plan.rows[0]!.id;
    await as(db, user(alice), () => db.query(`insert into public.meal_plan_items (meal_plan_id, day, slot, recipe_id) values ($1, 1, 'lunch', 'lentil-stew')`, [planId]));
    await as(db, user(bob), async () => {
      expect((await db.query(`select * from public.meal_plans where id = $1`, [planId])).rows).toHaveLength(0);
      expect((await db.query(`select * from public.meal_plan_items where meal_plan_id = $1`, [planId])).rows).toHaveLength(0);
      expect((await db.query(`update public.meal_plans set budget_dzd = 1 where id = $1`, [planId])).affectedRows ?? 0).toBe(0);
      expect((await db.query(`delete from public.meal_plans where id = $1`, [planId])).affectedRows ?? 0).toBe(0);
      await rejects(db.query(`insert into public.meal_plan_items (meal_plan_id, day, slot, recipe_id) values ($1, 2, 'lunch', 'lentil-stew')`, [planId]), 'row-level security');
      await rejects(db.query(`insert into public.meal_plans (user_id, household_size) values ($1, 2)`, [alice]), 'row-level security');
    });
    const list = await as(db, user(alice), () => db.query<{ id: string }>(`insert into public.saved_lists (title) values ('week') returning id`));
    await as(db, user(bob), async () => {
      expect((await db.query(`select * from public.saved_lists where id = $1`, [list.rows[0]!.id])).rows).toHaveLength(0);
      await rejects(db.query(`insert into public.saved_list_items (list_id, ingredient_id, quantity, unit) values ($1, 'potato', 1, 'kg')`, [list.rows[0]!.id]), 'row-level security');
    });
  });
});

describe('moderation, flags and corroboration', () => {
  it('admins can approve; approved reports become public; the action is audited', async () => {
    const r = await submit(alice, { product: 'zucchini', price: '110', qty: '1' });
    const id = r.rows[0]!.id;
    const status = await as(db, user(admin), () => db.query<{ s: string }>(`select public.moderate_price_report($1, 'approve') as s`, [id]));
    expect(status.rows[0]!.s).toBe('approved');
    const pub = await as(db, ANON, () => db.query(`select * from public.public_price_observations where id = $1`, [id]));
    expect(pub.rows).toHaveLength(1);
    const events = await as(db, user(admin), () => db.query(`select * from public.moderation_events where report_id = $1`, [id]));
    expect(events.rows).toHaveLength(1);
    const hidden = await as(db, user(alice), () => db.query(`select * from public.moderation_events where report_id = $1`, [id]));
    expect(hidden.rows).toHaveLength(0); // audit trail is moderator-only
    const mine = await as(db, user(alice), () => db.query<{ id: string; status: string }>(`select id, status from public.my_price_reports()`));
    expect(mine.rows.find((x) => x.id === id)!.status).toBe('approved');
  });

  it('shows self-reported (no shop) pending reports in the moderation queue', async () => {
    const submitted = await as(db, user(alice), () =>
      db.query<{ id: string }>(
        `select id from public.submit_report_with_location(
          'onions'::text, 80::numeric, 1::numeric, 'kg'::public.unit_code, $1::date, 'Souk El Djemaa'::text,
          34.67::numeric, 3.25::numeric, null::text, true, null::text, null::text, null::text
        )`,
        [today],
      ),
    );
    const id = submitted.rows[0]!.id;
    const queue = await as(db, user(admin), () =>
      db.query<{ id: string; shop_name: string }>(`select id, shop_name from public.moderation_queue('pending')`),
    );
    const row = queue.rows.find((x) => x.id === id);
    expect(row).toBeDefined();
    expect(row!.shop_name).toBe('Souk El Djemaa');
  });

  it('moderators cannot be bypassed by invalid transitions', async () => {
    const r = await submit(alice, { product: 'lentils', price: '280', qty: '1' });
    const id = r.rows[0]!.id;
    await as(db, user(admin), async () => {
      await db.query(`select public.moderate_price_report($1, 'reject', 'test')`, [id]);
      await rejects(db.query(`select public.moderate_price_report($1, 'reject')`, [id]), 'invalid_input');
      await rejects(db.query(`select public.moderate_price_report($1, 'delete')`, [id]), 'invalid_input');
    });
  });

  it('users can flag approved reports once; pending reports cannot be flagged', async () => {
    const approved = await as(db, ANON, () => db.query<{ id: string }>(`select id from public.public_price_observations limit 1`));
    const id = approved.rows[0]!.id;
    await as(db, user(bob), async () => {
      await db.query(`select public.flag_price_report($1, 'wrong_price', 'looks off')`, [id]);
      await db.query(`select public.flag_price_report($1, 'wrong_price')`, [id]); // ignored duplicate
      const flags = await db.query(`select * from public.report_flags where report_id = $1`, [id]);
      expect(flags.rows).toHaveLength(1);
    });
    await as(db, user(alice), async () => {
      expect((await db.query(`select * from public.report_flags where report_id = $1`, [id])).rows).toHaveLength(0);
    });
    const pending = await submit(bob, { product: 'rice', price: '220', qty: '1' });
    await as(db, user(alice), () => rejects(db.query(`select public.flag_price_report($1, 'spam')`, [pending.rows[0]!.id]), 'invalid_input'));
    await as(db, ANON, () => rejects(db.query(`select public.flag_price_report($1, 'spam')`, [id]), 'permission denied'));
  });

  it('counts corroboration only from distinct other contributors', async () => {
    const shop2 = await createRealShop(db);
    const a = await submit(alice, { product: 'potatoes', shop: shop2, price: '100', qty: '1' });
    const b = await submit(bob, { product: 'potatoes', shop: shop2, price: '102', qty: '1' });
    await as(db, user(admin), async () => {
      await db.query(`select public.moderate_price_report($1, 'approve')`, [a.rows[0]!.id]);
      await db.query(`select public.moderate_price_report($1, 'approve')`, [b.rows[0]!.id]);
    });
    const pub = await as(db, ANON, () =>
      db.query<{ corroborating_reports: number }>(`select corroborating_reports from public.public_price_observations where shop_id = $1`, [shop2]),
    );
    expect(pub.rows.map((r) => r.corroborating_reports)).toEqual([1, 1]);
  });
});

describe('public read API', () => {
  it('search_products is parameterized and treats wildcards literally', async () => {
    await as(db, ANON, async () => {
      const r = await db.query<{ id: string }>(`select id from public.search_products($1)`, ['pomme']);
      expect(r.rows.map((x) => x.id)).toContain('potatoes');
      expect((await db.query(`select id from public.search_products($1)`, ['%'])).rows).toHaveLength(0);
      expect((await db.query(`select id from public.search_products($1)`, ["'; drop table public.products; --"])).rows).toHaveLength(0);
      expect((await db.query(`select count(*)::int as n from public.products`)).rows[0]).toEqual({ n: 28 });
    });
  });

  it('area_coverage separates demo data from genuine reports', async () => {
    const r = await as(db, ANON, () => db.query<{ demo_shop_count: number; demo_reports: number; shop_count: number }>(`select * from public.area_coverage(17::smallint)`));
    expect(r.rows[0]!.demo_shop_count).toBe(8);
    expect(r.rows[0]!.demo_reports).toBeGreaterThan(0);
    expect(r.rows[0]!.shop_count).toBeGreaterThan(0);
  });

  it('demo observations are flagged as demo in the public view', async () => {
    const r = await as(db, ANON, () => db.query<{ n: number }>(`select count(*)::int as n from public.public_price_observations where source = 'demo' and not is_demo`));
    expect(r.rows[0]!.n).toBe(0);
  });
});
