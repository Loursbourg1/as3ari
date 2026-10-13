import type { Category, Product } from './types';

/**
 * Normalize text for matching: case-fold, strip Latin diacritics, unify common
 * Arabic letter variants, remove tatweel/tashkeel and collapse whitespace.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function scoreField(field: string, q: string): number {
  if (!field) return 0;
  if (field === q) return 100;
  if (field.startsWith(q)) return 80;
  const words = field.split(' ');
  if (words.some((w) => w.startsWith(q))) return 65;
  if (field.includes(q)) return 45;
  // Light typo tolerance for queries of 4+ characters ("potatos", "tomatoe").
  if (q.length >= 4 && words.some((w) => levenshteinAtMostOne(w, q) || (w.length > q.length && levenshteinAtMostOne(w.slice(0, q.length + 1), q)))) return 30;
  return 0;
}

export interface ProductMatch {
  product: Product;
  score: number;
}

export function searchProducts(products: Product[], categories: Category[], query: string, limit = 8): ProductMatch[] {
  const q = normalizeText(query);
  if (!q) return [];
  const catNames = new Map(categories.map((c) => [c.id, [c.name_en, c.name_fr, c.name_ar].map(normalizeText)]));
  const out: ProductMatch[] = [];
  for (const p of products) {
    const fields = [p.name_en, p.name_fr, p.name_ar, p.variant_en ?? '', p.variant_fr ?? '', p.variant_ar ?? '', ...p.search_terms].map(normalizeText);
    let score = Math.max(...fields.map((f) => scoreField(f, q)));
    const cat = catNames.get(p.category_id) ?? [];
    score = Math.max(score, ...cat.map((f) => Math.round(scoreField(f, q) * 0.4)));
    if (score > 0) out.push({ product: p, score });
  }
  return out
    .sort((a, b) => b.score - a.score || a.product.name_en.localeCompare(b.product.name_en))
    .slice(0, limit);
}
