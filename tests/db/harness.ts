import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(import.meta.dirname, '../..');

export async function createTestDb(opts: { demo?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(import.meta.dirname, 'supabase-shim.sql'), 'utf8'));
  const migDir = join(root, 'supabase/migrations');
  for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  await db.exec(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  if (opts.demo !== false) await db.exec(readFileSync(join(root, 'supabase/demo_seed.sql'), 'utf8'));
  return db;
}

export type Actor = { role: 'anon' } | { role: 'authenticated'; uid: string } | { role: 'superuser' };

export const ANON: Actor = { role: 'anon' };
export const user = (uid: string): Actor => ({ role: 'authenticated', uid });

/** Run queries as a given database role with Supabase-style JWT claims. */
export async function as<T>(db: PGlite, actor: Actor, fn: () => Promise<T>): Promise<T> {
  await db.exec('reset role');
  const claims = actor.role === 'authenticated' ? JSON.stringify({ sub: actor.uid, role: 'authenticated' }) : actor.role === 'anon' ? JSON.stringify({ role: 'anon' }) : '';
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  if (actor.role !== 'superuser') await db.exec(`set role ${actor.role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

export async function createUser(db: PGlite, opts: { verified?: boolean; role?: 'admin' | 'moderator' } = {}): Promise<string> {
  const id = randomUUID();
  await db.exec('reset role');
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [
    id,
    `${id}@example.test`,
    opts.verified === false ? null : new Date().toISOString(),
  ]);
  if (opts.role) await db.query(`insert into public.user_roles (user_id, role) values ($1, $2)`, [id, opts.role]);
  return id;
}

export async function createRealShop(db: PGlite, name = `Test shop ${randomUUID().slice(0, 8)}`): Promise<string> {
  await db.exec('reset role');
  const r = await db.query<{ id: string }>(
    `insert into public.shops (name, kind, wilaya_code, area_id, lat, lng, provenance, provenance_note)
     values ($1, 'grocery', 17, 'djelfa', 34.67 + random() / 100, 3.25 + random() / 100, 'verified_visit', 'test fixture') returning id`,
    [name],
  );
  return r.rows[0]!.id;
}

/** Expect a promise to reject with a message containing `fragment`. */
export async function rejects(p: Promise<unknown>, fragment: string): Promise<void> {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (!msg.includes(fragment)) throw new Error(`Expected error containing "${fragment}", got "${msg}"`, { cause: e });
    return;
  }
  throw new Error(`Expected rejection containing "${fragment}", but it succeeded`);
}
