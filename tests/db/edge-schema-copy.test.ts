import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

describe('edge function schema copy', () => {
  it('is identical to the app schema except for the zod import', () => {
    const strip = (s: string) => s.replace(/^import \{ z \} from '[^']+';$/m, '').replace(/\r\n/g, '\n');
    const app = readFileSync(resolve(root, 'src/domain/reportSchema.ts'), 'utf8');
    const edge = readFileSync(resolve(root, 'supabase/functions/_shared/reportSchema.ts'), 'utf8');
    expect(strip(edge)).toBe(strip(app));
  });
});
